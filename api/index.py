import os
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from urllib.parse import quote
from flask import Flask, request, jsonify
from flask_cors import CORS
import libsql_client
from werkzeug.security import generate_password_hash, check_password_hash
from fpdf import FPDF
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# -----------------------------------------------------------------------------
# MIDDLEWARE PARA PRESERVAR RUTAS REALES EN VERCEL SERVERLESS
# -----------------------------------------------------------------------------
from urllib.parse import parse_qsl, urlencode

class VercelPathFix:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        qs = environ.get("QUERY_STRING", "")
        params = parse_qsl(qs, keep_blank_values=True)
        real_path = None
        resto = []
        for k, v in params:
            if k == "__path":
                real_path = v
            else:
                resto.append((k, v))

        if real_path is not None:
            environ["PATH_INFO"] = "/api/" + real_path.strip("/")
            environ["QUERY_STRING"] = urlencode(resto)

        return self.app(environ, start_response)

app.wsgi_app = VercelPathFix(app.wsgi_app)

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "clave_secreta_para_tokens_jwt")

# -----------------------------------------------------------------------------
# CONEXIÓN A BASE DE DATOS TURSO (libSQL) CON CREDENCIALES CONFIGURADAS
# -----------------------------------------------------------------------------
DEFAULT_TURSO_URL = "https://tienda-ropa-db-armandourrutia.aws-us-east-1.turso.io"
DEFAULT_TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE1NjY2ODUsImlkIjoiMDFhMTIxOWEtYzQwMS03MGI2LWEyYzctM2M2OTU2YmQzNWJmIiwia2lkIjoibTMxSVZyRXZKdW8xZWtheld1SjZ6ek1Mc1E5UXlVTHp1cnVmdGZsaUZYcyIsInJpZCI6IjZhNzU2Yzc0LTAyODctNGZjNC1hYjg4LTUwYjI5ODc1YmVjMSJ9.kdM2UBjBFEMdr2kMTdxiDiKMhh2q922DZymzy9u4anELsTzCfZduvjQID1HMxAq0UP_UYZ-zi1QUAhmZRSZbDg"

def get_db():
    url = os.environ.get("TURSO_DATABASE_URL", DEFAULT_TURSO_URL)
    token = os.environ.get("TURSO_AUTH_TOKEN", DEFAULT_TURSO_TOKEN)
    
    if url.startswith("libsql://"):
        url = url.replace("libsql://", "https://")
        
    return libsql_client.create_client_sync(url=url, auth_token=token)

# -----------------------------------------------------------------------------
# GENERACIÓN DE PDF EN MEMORIA RAM
# -----------------------------------------------------------------------------
def generar_pdf_pedido(id_pedido, cliente_nombre, cliente_correo, cliente_telefono, items, total_usdt):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    
    pdf.cell(0, 10, "COMPROBANTE DE PEDIDO", ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Pedido #: {id_pedido}", ln=True, align="C")
    pdf.ln(5)
    
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 6, "Datos del Cliente:", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Nombre: {cliente_nombre}", ln=True)
    pdf.cell(0, 5, f"Correo: {cliente_correo}", ln=True)
    pdf.cell(0, 5, f"Telefono: {cliente_telefono}", ln=True)
    pdf.ln(5)
    
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(80, 7, "Producto", border=1)
    pdf.cell(25, 7, "Color", border=1)
    pdf.cell(20, 7, "Talla", border=1)
    pdf.cell(20, 7, "Cant.", border=1, align="C")
    pdf.cell(25, 7, "Precio", border=1, align="R")
    pdf.cell(20, 7, "Subtotal", border=1, align="R")
    pdf.ln()
    
    pdf.set_font("Helvetica", "", 9)
    for item in items:
        nombre = str(item.get("nombre", "Producto"))[:35]
        color = str(item.get("color", "-"))
        talla = str(item.get("talla", "-"))
        cantidad = int(item.get("cantidad", 1))
        precio = float(item.get("precio_usdt", 0))
        subtotal = cantidad * precio
        
        pdf.cell(80, 6, nombre, border=1)
        pdf.cell(25, 6, color, border=1)
        pdf.cell(20, 6, talla, border=1)
        pdf.cell(20, 6, str(cantidad), border=1, align="C")
        pdf.cell(25, 6, f"${precio:.2f}", border=1, align="R")
        pdf.cell(20, 6, f"${subtotal:.2f}", border=1, align="R")
        pdf.ln()
        
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, f"TOTAL: ${total_usdt:.2f} USDT", ln=True, align="R")
    
    pdf_output = pdf.output()
    if isinstance(pdf_output, (bytes, bytearray)):
        return bytes(pdf_output)
    return pdf_output.encode("latin1")

# -----------------------------------------------------------------------------
# ENVÍO DE CORREOS ASÍNCRONO VIA SMTP
# -----------------------------------------------------------------------------
def enviar_notificaciones_correo(cliente_nombre, cliente_correo, cliente_telefono, id_pedido, total_usdt, pdf_bytes):
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_email = os.environ.get("SMTP_EMAIL", "")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    admin_email = os.environ.get("ADMIN_EMAIL", smtp_email)

    if not smtp_email or not smtp_password:
        return False

    try:
        msg_cliente = MIMEMultipart()
        msg_cliente["From"] = smtp_email
        msg_cliente["To"] = cliente_correo
        msg_cliente["Subject"] = f"Confirmación de Pedido #{id_pedido} - Tienda de Ropa"
        
        cuerpo_cliente = f"""Hola {cliente_nombre},

¡Gracias por tu pedido #{id_pedido}!
Adjunto a este correo encontrarás el comprobante de tu orden en formato PDF.

Total a pagar: ${total_usdt:.2f} USDT

Para coordinar el pago y el envío, por favor ponte en contacto con nosotros vía WhatsApp.
"""
        msg_cliente.attach(MIMEText(cuerpo_cliente, "plain", "utf-8"))
        
        adj_cliente = MIMEApplication(pdf_bytes, _subtype="pdf")
        adj_cliente.add_header("Content-Disposition", "attachment", filename=f"Pedido_{id_pedido}.pdf")
        msg_cliente.attach(adj_cliente)

        msg_admin = MIMEMultipart()
        msg_admin["From"] = smtp_email
        msg_admin["To"] = admin_email
        msg_admin["Subject"] = f"¡NUEVO PEDIDO RECIBIDO! Orden #{id_pedido} - {cliente_nombre}"
        
        cuerpo_admin = f"""Se ha registrado una nueva solicitud de compra:

Pedido #: {id_pedido}
Cliente: {cliente_nombre}
Correo: {cliente_correo}
Teléfono: {cliente_telefono}
Monto Total: ${total_usdt:.2f} USDT

Adjunto se encuentra la orden de pedido generada.
"""
        msg_admin.attach(MIMEText(cuerpo_admin, "plain", "utf-8"))
        
        adj_admin = MIMEApplication(pdf_bytes, _subtype="pdf")
        adj_admin.add_header("Content-Disposition", "attachment", filename=f"Pedido_{id_pedido}.pdf")
        msg_admin.attach(adj_admin)

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, cliente_correo, msg_cliente.as_string())
        server.sendmail(smtp_email, admin_email, msg_admin.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error al enviar correo SMTP: {str(e)}")
        return False

# -----------------------------------------------------------------------------
# ENDPOINTS Y RUTAS API
# -----------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"exito": True, "mensaje": "API Serverless activa correctamente"}), 200

# 1. AUTENTICACIÓN
@app.route("/api/auth/registro", methods=["POST"])
def registro():
    try:
        data = request.get_json() or {}
        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        clave = data.get("clave", "").strip()

        if not nombre or not correo or not clave:
            return jsonify({"exito": False, "mensaje": "Todos los campos son obligatorios"}), 400

        db = get_db()
        existe = db.execute("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo])
        if len(existe.rows) > 0:
            return jsonify({"exito": False, "mensaje": "El correo electrónico ya está registrado"}), 400

        clave_hash = generate_password_hash(clave)
        db.execute("INSERT INTO usuarios (nombre, correo, clave_hash, rol) VALUES (?, ?, ?, 'cliente')",
                   [nombre, correo, clave_hash])

        res = db.execute("SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE correo = ?", [correo])
        row = res.rows[0]
        usuario = {"id_usuario": row[0], "nombre": row[1], "correo": row[2], "rol": row[3]}

        return jsonify({"exito": True, "mensaje": "Usuario registrado exitosamente", "datos": usuario}), 201
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error en registro: {str(e)}"}), 500

@app.route("/api/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}
        correo = data.get("correo", "").strip().lower()
        clave = data.get("clave", "").strip()

        if not correo or not clave:
            return jsonify({"exito": False, "mensaje": "Correo y contraseña requeridos"}), 400

        db = get_db()
        res = db.execute("SELECT id_usuario, nombre, correo, clave_hash, rol FROM usuarios WHERE correo = ?", [correo])
        if len(res.rows) == 0:
            return jsonify({"exito": False, "mensaje": "Credenciales inválidas"}), 401

        row = res.rows[0]
        id_usuario, nombre, correo_db, clave_hash, rol = row[0], row[1], row[2], row[3], row[4]

        if not check_password_hash(clave_hash, clave):
            return jsonify({"exito": False, "mensaje": "Credenciales inválidas"}), 401

        usuario = {"id_usuario": id_usuario, "nombre": nombre, "correo": correo_db, "rol": rol}
        return jsonify({"exito": True, "mensaje": "Sesión iniciada correctamente", "datos": usuario}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error en login: {str(e)}"}), 500

# 2. CATEGORÍAS
@app.route("/api/categorias", methods=["GET"])
def obtener_categorias():
    try:
        db = get_db()
        res = db.execute("SELECT id_categoria, nombre_categoria FROM categorias WHERE estado = 1 ORDER BY nombre_categoria ASC")
        categorias = [{"id_categoria": r[0], "nombre_categoria": r[1]} for r in res.rows]
        return jsonify({"exito": True, "datos": categorias}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al consultar categorías: {str(e)}"}), 500

# 3. PRODUCTOS (CATÁLOGO PÚBLICO)
@app.route("/api/productos", methods=["GET"])
def listar_productos_publicos():
    try:
        cat_id = request.args.get("categoria", "")
        busqueda = request.args.get("busqueda", "").strip()

        db = get_db()
        query = """
            SELECT p.id_producto, p.nombre, p.descripcion, p.precio_usdt, p.id_categoria, 
                   c.nombre_categoria, p.color, p.talla, p.imagen_url, p.estado
            FROM productos p
            LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
            WHERE p.estado = 1
        """
        params = []

        if cat_id:
            query += " AND p.id_categoria = ?"
            params.append(cat_id)
        if busqueda:
            query += " AND (p.nombre LIKE ? OR p.descripcion LIKE ?)"
            params.append(f"%{busqueda}%")
            params.append(f"%{busqueda}%")

        query += " ORDER BY p.id_producto DESC"
        res = db.execute(query, params)

        productos = []
        for r in res.rows:
            productos.append({
                "id_producto": r[0],
                "nombre": r[1],
                "descripcion": r[2],
                "precio_usdt": r[3],
                "id_categoria": r[4],
                "nombre_categoria": r[5] or "General",
                "color": r[6],
                "talla": r[7],
                "imagen_url": r[8] or "",
                "estado": r[9]
            })

        return jsonify({"exito": True, "datos": productos}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al obtener productos: {str(e)}"}), 500

# 4. PRODUCTOS (PANEL ADMINISTRADOR - INCLUYE INACTIVOS)
@app.route("/api/productos/admin", methods=["GET"])
def listar_productos_admin():
    try:
        db = get_db()
        query = """
            SELECT p.id_producto, p.nombre, p.descripcion, p.precio_usdt, p.id_categoria, 
                   c.nombre_categoria, p.color, p.talla, p.imagen_url, p.estado
            FROM productos p
            LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
            ORDER BY p.id_producto DESC
        """
        res = db.execute(query)

        productos = []
        for r in res.rows:
            productos.append({
                "id_producto": r[0],
                "nombre": r[1],
                "descripcion": r[2],
                "precio_usdt": r[3],
                "id_categoria": r[4],
                "nombre_categoria": r[5] or "General",
                "color": r[6],
                "talla": r[7],
                "imagen_url": r[8] or "",
                "estado": r[9]
            })

        return jsonify({"exito": True, "datos": productos}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error admin productos: {str(e)}"}), 500

@app.route("/api/productos/<int:id_producto>", methods=["GET"])
def detalle_producto(id_producto):
    try:
        db = get_db()
        res = db.execute("""
            SELECT p.id_producto, p.nombre, p.descripcion, p.precio_usdt, p.id_categoria, 
                   c.nombre_categoria, p.color, p.talla, p.imagen_url, p.estado
            FROM productos p
            LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
            WHERE p.id_producto = ?
        """, [id_producto])

        if len(res.rows) == 0:
            return jsonify({"exito": False, "mensaje": "Producto no encontrado"}), 404

        r = res.rows[0]
        producto = {
            "id_producto": r[0],
            "nombre": r[1],
            "descripcion": r[2],
            "precio_usdt": r[3],
            "id_categoria": r[4],
            "nombre_categoria": r[5] or "General",
            "color": r[6],
            "talla": r[7],
            "imagen_url": r[8] or "",
            "estado": r[9]
        }
        return jsonify({"exito": True, "datos": producto}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al obtener detalle: {str(e)}"}), 500

# 5. GESTIÓN CRUD DE PRODUCTOS (ADMIN)
@app.route("/api/productos", methods=["POST"])
def crear_producto():
    try:
        data = request.get_json() or {}
        nombre = data.get("nombre", "").strip()
        descripcion = data.get("descripcion", "").strip()
        precio_usdt = float(data.get("precio_usdt", 0))
        id_categoria = data.get("id_categoria")
        color = data.get("color", "").strip()
        talla = data.get("talla", "").strip()
        imagen_url = data.get("imagen_url", "").strip()

        if not nombre or precio_usdt <= 0 or not color or not talla:
            return jsonify({"exito": False, "mensaje": "Datos obligatorios incompletos o inválidos"}), 400

        db = get_db()
        db.execute("""
            INSERT INTO productos (nombre, descripcion, precio_usdt, id_categoria, color, talla, imagen_url, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, [nombre, descripcion, precio_usdt, id_categoria, color, talla, imagen_url])

        res = db.execute("SELECT id_producto FROM productos WHERE nombre = ? ORDER BY id_producto DESC LIMIT 1", [nombre])
        nuevo_id = res.rows[0][0]

        return jsonify({"exito": True, "mensaje": "Producto creado con éxito", "id_producto": nuevo_id}), 201
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al crear producto: {str(e)}"}), 500

@app.route("/api/productos/<int:id_producto>", methods=["PUT"])
def actualizar_producto(id_producto):
    try:
        data = request.get_json() or {}
        nombre = data.get("nombre", "").strip()
        descripcion = data.get("descripcion", "").strip()
        precio_usdt = float(data.get("precio_usdt", 0))
        id_categoria = data.get("id_categoria")
        color = data.get("color", "").strip()
        talla = data.get("talla", "").strip()
        imagen_url = data.get("imagen_url", "").strip()
        estado = int(data.get("estado", 1))

        if not nombre or precio_usdt <= 0 or not color or not talla:
            return jsonify({"exito": False, "mensaje": "Campos obligatorios requeridos"}), 400

        db = get_db()
        db.execute("""
            UPDATE productos 
            SET nombre = ?, descripcion = ?, precio_usdt = ?, id_categoria = ?, 
                color = ?, talla = ?, imagen_url = ?, estado = ?
            WHERE id_producto = ?
        """, [nombre, descripcion, precio_usdt, id_categoria, color, talla, imagen_url, estado, id_producto])

        return jsonify({"exito": True, "mensaje": "Producto actualizado correctamente"}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al actualizar producto: {str(e)}"}), 500

@app.route("/api/productos/<int:id_producto>", methods=["DELETE"])
def eliminar_producto_logico(id_producto):
    try:
        db = get_db()
        db.execute("UPDATE productos SET estado = 0 WHERE id_producto = ?", [id_producto])
        return jsonify({"exito": True, "mensaje": "Producto desactivado del catálogo"}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al eliminar producto: {str(e)}"}), 500

# 6. PROCESAMIENTO DE CHECKOUT Y PEDIDOS
@app.route("/api/checkout", methods=["POST"])
def checkout():
    try:
        data = request.get_json() or {}
        id_usuario = data.get("id_usuario")
        cliente_nombre = data.get("cliente_nombre", "").strip()
        cliente_correo = data.get("cliente_correo", "").strip().lower()
        cliente_telefono = data.get("cliente_telefono", "").strip()
        items = data.get("items", [])

        if not cliente_nombre or not cliente_correo or not cliente_telefono or not items:
            return jsonify({"exito": False, "mensaje": "Faltan información del cliente o items del carrito"}), 400

        total_usdt = 0.0
        for item in items:
            cant = int(item.get("cantidad", 1))
            pu = float(item.get("precio_usdt", 0))
            total_usdt += cant * pu

        db = get_db()
        
        db.execute("""
            INSERT INTO pedidos (id_usuario, cliente_nombre, cliente_correo, cliente_telefono, total_usdt)
            VALUES (?, ?, ?, ?, ?)
        """, [id_usuario, cliente_nombre, cliente_correo, cliente_telefono, total_usdt])

        res_p = db.execute("SELECT id_pedido FROM pedidos WHERE cliente_correo = ? ORDER BY id_pedido DESC LIMIT 1", [cliente_correo])
        id_pedido = res_p.rows[0][0]

        for item in items:
            db.execute("""
                INSERT INTO detalles_pedido (id_pedido, id_producto, cantidad, precio_unitario, color, talla)
                VALUES (?, ?, ?, ?, ?, ?)
            """, [
                id_pedido,
                item.get("id_producto"),
                int(item.get("cantidad", 1)),
                float(item.get("precio_usdt", 0)),
                item.get("color", ""),
                item.get("talla", "")
            ])

        pdf_bytes = generar_pdf_pedido(id_pedido, cliente_nombre, cliente_correo, cliente_telefono, items, total_usdt)
        enviar_notificaciones_correo(cliente_nombre, cliente_correo, cliente_telefono, id_pedido, total_usdt, pdf_bytes)

        whatsapp_number = os.environ.get("WHATSAPP_NUMBER", "584120700903")
        mensaje_wa = f"Hola, acabo de realizar el Pedido #{id_pedido} a nombre de {cliente_nombre} por un total de ${total_usdt:.2f} USDT. Quisiera coordinar el pago."
        wa_link = f"https://wa.me/{whatsapp_number}?text={quote(mensaje_wa)}"

        return jsonify({
            "exito": True,
            "mensaje": "Pedido procesado y enviado a tu correo exitosamente",
            "datos": {
                "id_pedido": id_pedido,
                "total_usdt": total_usdt,
                "whatsapp_url": wa_link
            }
        }), 201

    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al procesar checkout: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)