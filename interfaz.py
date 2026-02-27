"""
╔═══════════════════════════════════════════════════════════════════════╗
║              INTERFAZ GRÁFICA - ENCRIPTADOR MATRICIAL                ║
║                                                                       ║
║  Interfaz profesional, intuitiva y visualmente mejorada para:       ║
║  • Autenticación segura de usuarios                                 ║
║  • Encriptación con visualización de datos intermedios              ║
║  • Desencriptación inmediata                                        ║
║  • Historial de operaciones                                         ║
║  • Visualización formateada de matrices y códigos                   ║
╚═══════════════════════════════════════════════════════════════════════╝

CARACTERÍSTICAS PRINCIPALES:
============================
✓ Autenticación con límite de intentos (MAX_INTENTOS = 3)
✓ Interfaz dividida en 6 secciones claras:
  1. 🔐 Autenticación (Login)
  2. 📝 Entrada de Texto
  3. 🎯 Botones de Acción
  4. 📊 Resultados:
     - 1️⃣ Código Unicode
     - 2️⃣ Matriz de Encriptación
     - 3️⃣ Clave (K)
     - 4️⃣ Permutación
     - 5️⃣ Matriz Cifrada
✓ Esquema de colores profesional
✓ Emojis para identificación visual
✓ Área de resultados con scroll
✓ Formateo automático de matrices
✓ Manejo robusto de errores

FLUJO DE USUARIO (HAPPY PATH):
==============================
1. Inicia aplicación → request("Ingrese usuario y password")
   Usuario: Mile
   Password: 1234

2. Login exitoso → Muestra pantalla principal

3. Ingresa texto: "Hola"

4. Click [ENCRIPTAR] → Realiza:
   - Calcula n = 2 (matriz 2×2)
   - Genera clave aleatoria invertible
   - Genera permutación aleatoria
   - Muestra: Unicode → Clave → Permutación → Cifrado

5. Click [DESENCRIPTAR] → Recupera: "Hola"

6. Puede [VER HISTORIAL] → Muestra todas las operaciones
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
from core import (
    ServicioAutenticacion,
    ServicioEncriptacion,
    AutenticacionError,
    EncriptacionError,
    TAMAÑO_VENTANA,
    logger
)


class InterfazEncriptador:
    """
    INTERFAZ GRÁFICA DEL ENCRIPTADOR MATRICIAL
    ============================================
    
    Responsabilidades:
    ===================
    1. Gestionar flujo de autenticación con límite de intentos
    2. Mostrar pantalla principal después de login exitoso
    3. Procesar entrada de usuario (texto a encriptar)
    4. Llamar a servicios de encriptación/desencriptación
    5. Mostrar datos intermedios (Unicode, clave, permutación)
    6. Visualizar matriz cifrada en formato legible
    7. Mostrar historial de todas las operaciones
    
    Atributos principales:
    =======================
    - root: Ventana principal tkinter (900x800)
    - auth: Instancia de ServicioAutenticacion
    - encryption: Instancia de ServicioEncriptacion
    - main: Frame principal contenedor
    
    Métodos públicos:
    ==================
    - show_login(): Mostrar pantalla de autenticación
    - show_main(): Mostrar interfaz principal
    - check_login(): Verificar credenciales
    - encriptar(): Encriptar texto ingresado
    - desencriptar(): Desencriptar cifrado actual
    - ver_historial(): Mostrar todas las operaciones
    - on_closing(): Cerrar aplicación correctamente
    
    Métodos privados (helpers):
    ============================
    - _configurar_estilos(): Configurar tema ttk
    - _crear_seccion_entrada(): Crear área de entrada de texto
    - _crear_seccion_botones(): Crear botones de acción
    - _crear_seccion_resultados(): Crear área con scroll
    - _formatear_matriz(): Convertir matriz a string visual
    """
    
    # ==================== CONSTANTES DE ESTILO ====================
    
    # Colores personalizados para interfaz profesional
    COLOR_FONDO = "#f0f0f0"      # Gris claro (fondo principal ventana)
    COLOR_TITULO = "#1e3a8a"     # Azul oscuro (encabezados secciones)
    COLOR_BOTON = "#3b82f6"      # Azul claro (botones de acción)
    
    # ==================== MÉTODO: INICIALIZAR ====================
    
    def __init__(self) -> None:
        """
        INICIALIZAR INTERFAZ GRÁFICA
        =============================
        
        Proceso de inicialización:
        ===========================
        1. Instanciar servicios:
           - auth = ServicioAutenticacion()  # Para validar usuario/password
           - encryption = ServicioEncriptacion()  # Para encriptar/desencriptar
        
        2. Crear ventana tkinter principal:
           - Título con emoji: "🔐 Sistema de Encriptación Matricial"
           - Tamaño: 900x800 píxeles
           - Fondo: COLOR_FONDO (#f0f0f0)
        
        3. Configurar apariencia:
           - Aplicar estilos ttk personalizados --> _configurar_estilos()
        
        4. Crear frame principal:
           - ttk.Frame con padding 15px
           - Empaca todo el contenido
        
        5. Mostrar pantalla inicial:
           - show_login() --> Pide usuario/password
        
        6. Configurar eventos:
           - Evento cierre ventana --> on_closing()
           - Evento mainloop --> user interaction loop
        
        Flow:
            ServicioAutenticacion() ──────┐
            ServicioEncriptacion() ───────┼──> InterfazEncriptador
            tk.Tk() ──────────────────────┤
            _configurar_estilos() ────────┤
            show_login() ──────────────────┤
            mainloop() ────────────────────┘
        """
        logger.info("Iniciando interfaz mejorada")
        
        # Instanciar servicios principales
        self.auth = ServicioAutenticacion()  # Gestiona autenticación
        self.encryption = ServicioEncriptacion()  # Gestiona encriptación
        
        # Crear ventana principal
        self.root = tk.Tk()
        self.root.title("🔐 Sistema de Encriptación Matricial")  # Título con emoji
        self.root.geometry(TAMAÑO_VENTANA)  # Tamaño: 900x800
        self.root.configure(bg=self.COLOR_FONDO)  # Fondo gris claro
        
        # Configurar estilos ttk para consistencia
        self._configurar_estilos()
        
        # Frame principal contenedor
        self.main = ttk.Frame(self.root, padding=15)
        self.main.pack(fill="both", expand=True)
        
        # Mostrar pantalla de login
        self.show_login()
        
        # Configurar evento de cierre
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Iniciar loop de eventos
        self.root.mainloop()
    
    def _configurar_estilos(self):
        """Configurar estilos visuales de la aplicación."""
        style = ttk.Style()
        style.theme_use('clam')
        
        # Estilo para títulos
        style.configure('Titulo.TLabel', 
                       font=("Arial", 18, "bold"),
                       foreground=self.COLOR_TITULO,
                       background=self.COLOR_FONDO)
        
        # Estilo para subtítulos
        style.configure('Subtitulo.TLabel',
                       font=("Arial", 11, "bold"),
                       foreground=self.COLOR_TITULO,
                       background=self.COLOR_FONDO)
        
        # Estilo para texto normal
        style.configure('TLabel',
                       font=("Arial", 10),
                       background=self.COLOR_FONDO)
    
    def limpiar(self):
        """Limpiar todos los widgets."""
        for widget in self.main.winfo_children():
            widget.destroy()
    
    # ===================== PANTALLA DE LOGIN =====================
    
    def show_login(self):
        """Mostrar pantalla de login."""
        self.limpiar()
        logger.debug("Mostrando pantalla de login")
        
        # Marco central
        frame_login = ttk.Frame(self.main)
        frame_login.pack(expand=True, fill="both")
        
        # Título
        ttk.Label(frame_login, text="🔐 ACCESO AL SISTEMA", style='Titulo.TLabel').pack(pady=20)
        
        # Separador visual
        ttk.Separator(frame_login, orient='horizontal').pack(fill="x", pady=10)
        
        # Frame para entrada
        frame_entrada = ttk.LabelFrame(frame_login, text="Credenciales", padding=20)
        frame_entrada.pack(pady=20, padx=20, fill="x")
        
        # Usuario
        ttk.Label(frame_entrada, text="👤 Usuario:", style='Subtitulo.TLabel').grid(row=0, column=0, sticky="w", pady=10)
        self.user_entry = ttk.Entry(frame_entrada, width=40, font=("Arial", 11))
        self.user_entry.grid(row=0, column=1, sticky="ew", padx=10)
        
        # Contraseña
        ttk.Label(frame_entrada, text="🔑 Contraseña:", style='Subtitulo.TLabel').grid(row=1, column=0, sticky="w", pady=10)
        self.pass_entry = ttk.Entry(frame_entrada, show="●", width=40, font=("Arial", 11))
        self.pass_entry.grid(row=1, column=1, sticky="ew", padx=10)
        
        frame_entrada.columnconfigure(1, weight=1)
        
        # Botón entrar
        ttk.Button(frame_login, text="▶ ENTRAR", command=self.check_login).pack(pady=20)
        
        # Información de credenciales
        info = ttk.LabelFrame(frame_login, text="ℹ️ Credenciales de Prueba", padding=10)
        info.pack(pady=10, padx=20, fill="x")
        ttk.Label(info, text="Usuario: Mile  |  Contraseña: 1234").pack()
    
    def check_login(self):
        """Verificar credenciales de login."""
        try:
            username = self.user_entry.get()
            password = self.pass_entry.get()
            
            if self.auth.autenticar(username, password):
                self.show_main()
        except AutenticacionError as e:
            messagebox.showerror("❌ Error de Autenticación", str(e))
            self.pass_entry.delete(0, tk.END)
            logger.warning(f"Login fallido: {str(e)}")
    
    # ===================== PANTALLA PRINCIPAL =====================
    
    def show_main(self):
        """Mostrar pantalla principal de encriptación."""
        self.limpiar()
        logger.info("Usuario autenticado - Mostrando pantalla principal")
        
        # Título
        ttk.Label(self.main, text="🔐 ENCRIPTACIÓN MATRICIAL", style='Titulo.TLabel').pack(pady=15)
        ttk.Separator(self.main, orient='horizontal').pack(fill="x", pady=5)
        
        # Crear canvas con scroll
        canvas = tk.Canvas(self.main, bg=self.COLOR_FONDO, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.main, orient="vertical", command=canvas.scroll)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True, padx=10)
        scrollbar.pack(side="right", fill="y")
        
        # Secciones
        self._crear_seccion_entrada(scrollable_frame)
        self._crear_seccion_botones(scrollable_frame)
        self._crear_seccion_resultados(scrollable_frame)
    
    def _crear_seccion_entrada(self, parent):
        """Crear sección de entrada de texto."""
        frame = ttk.LabelFrame(parent, text="📝 PASO 1: Ingrese su Texto", padding=15)
        frame.pack(fill="x", pady=10)
        
        ttk.Label(frame, text="Escriba el texto que desea encriptar:").pack(anchor="w")
        
        self.texto = tk.Text(frame, height=3, width=90, font=("Arial", 10), relief="solid", bd=1)
        self.texto.pack(fill="x", pady=10)
        
        ttk.Button(frame, text="🗑️ Limpiar", command=lambda: self.texto.delete("1.0", tk.END)).pack(anchor="e", pady=5)
    
    def _crear_seccion_botones(self, parent):
        """Crear sección de botones de acción."""
        frame = ttk.LabelFrame(parent, text="🎯 PASO 2: Seleccione Acción", padding=15)
        frame.pack(fill="x", pady=10)
        
        botones = ttk.Frame(frame)
        botones.pack(fill="x", pady=10)
        
        ttk.Button(botones, text="🔒 ENCRIPTAR", command=self.encriptar).pack(side="left", padx=5, expand=True)
        ttk.Button(botones, text="🔓 DESENCRIPTAR", command=self.desencriptar).pack(side="left", padx=5, expand=True)
        ttk.Button(botones, text="📋 HISTORIAL", command=self.ver_historial).pack(side="left", padx=5, expand=True)
        ttk.Button(botones, text="🚪 SALIR", command=self.on_closing).pack(side="left", padx=5, expand=True)
    
    def _crear_seccion_resultados(self, parent):
        """Crear sección de resultados."""
        frame = ttk.LabelFrame(parent, text="📊 PASO 3: Visualice Resultados", padding=15)
        frame.pack(fill="both", expand=True, pady=10)
        
        # Unicode
        ttk.Label(frame, text="1️⃣ Códigos Unicode del Texto:", style='Subtitulo.TLabel').pack(anchor="w", pady=(10, 5))
        self.unicode = tk.Text(frame, height=2, width=90, font=("Courier", 9), bg="#f9fafb", relief="solid", bd=1)
        self.unicode.pack(fill="x", pady=5)
        self.unicode.config(state="disabled")
        
        # Matriz Clave
        ttk.Label(frame, text="2️⃣ Matriz Clave (NxN Invertible):", style='Subtitulo.TLabel').pack(anchor="w", pady=(10, 5))
        self.clave = tk.Text(frame, height=4, width=90, font=("Courier", 8), bg="#f9fafb", relief="solid", bd=1)
        self.clave.pack(fill="x", pady=5)
        self.clave.config(state="disabled")
        
        # Permutación
        ttk.Label(frame, text="3️⃣ Permutación de Columnas:", style='Subtitulo.TLabel').pack(anchor="w", pady=(10, 5))
        self.perm = tk.Text(frame, height=2, width=90, font=("Courier", 9), bg="#f9fafb", relief="solid", bd=1)
        self.perm.pack(fill="x", pady=5)
        self.perm.config(state="disabled")
        
        # Cifrado
        ttk.Label(frame, text="4️⃣ Matriz Encriptada:", style='Subtitulo.TLabel').pack(anchor="w", pady=(10, 5))
        self.matriz = tk.Text(frame, height=4, width=90, font=("Courier", 8), bg="#f9fafb", relief="solid", bd=1)
        self.matriz.pack(fill="x", pady=5)
        self.matriz.config(state="disabled")
        
        # Desencriptado
        ttk.Label(frame, text="5️⃣ Texto Desencriptado:", style='Subtitulo.TLabel').pack(anchor="w", pady=(10, 5))
        self.resultado = tk.Text(frame, height=2, width=90, font=("Courier", 9), bg="#f9fafb", relief="solid", bd=1)
        self.resultado.pack(fill="x", pady=5)
        self.resultado.config(state="disabled")
    
    # ===================== FUNCIONES DE ENCRIPTACIÓN =====================
    
    def encriptar(self):
        """Encriptar el texto ingresado."""
        try:
            texto = self.texto.get("1.0", tk.END).strip()
            if not texto:
                messagebox.showwarning("⚠️ Advertencia", "Ingrese un texto para encriptar")
                return
            
            logger.info(f"Encriptando texto de {len(texto)} caracteres")
            
            from encriptador import Encriptador
            resultado = self.encryption.encriptar(texto, Encriptador)
            
            # Mostrar Unicode
            unicode_str = " | ".join([f"'{c}':{ord(c)}" for c in texto])
            self.unicode.config(state="normal")
            self.unicode.delete("1.0", tk.END)
            self.unicode.insert(tk.END, unicode_str)
            self.unicode.config(state="disabled")
            
            # Mostrar Clave
            self.clave.config(state="normal")
            self.clave.delete("1.0", tk.END)
            clave_formateada = self._formatear_matriz(resultado['clave'])
            self.clave.insert(tk.END, clave_formateada)
            self.clave.config(state="disabled")
            
            # Mostrar Permutación
            n = len(resultado['permutacion'])
            perm_str = f"Original: {tuple(range(n))}\nPermutado: {resultado['permutacion']}"
            self.perm.config(state="normal")
            self.perm.delete("1.0", tk.END)
            self.perm.insert(tk.END, perm_str)
            self.perm.config(state="disabled")
            
            # Mostrar Cifrado
            self.matriz.config(state="normal")
            self.matriz.delete("1.0", tk.END)
            cifrado_formateado = self._formatear_matriz(resultado['cifrado'])
            self.matriz.insert(tk.END, cifrado_formateado)
            self.matriz.config(state="disabled")
            
            # Limpiar resultado
            self.resultado.config(state="normal")
            self.resultado.delete("1.0", tk.END)
            self.resultado.config(state="disabled")
            
            messagebox.showinfo("✅ Éxito", f"Texto encriptado correctamente\n({len(texto)} caracteres)")
            logger.info("Encriptación exitosa")
        
        except Exception as e:
            messagebox.showerror("❌ Error", f"No se pudo encriptar: {str(e)}")
            logger.error(f"Error en encriptación: {str(e)}")
    
    def desencriptar(self):
        """Desencriptar el texto encriptado."""
        try:
            if not self.encryption.tiene_encriptacion_activa():
                messagebox.showerror("❌ Error", "Primero debe encriptar un texto")
                return
            
            pwd = simpledialog.askstring(
                "🔑 Contraseña Requerida",
                "Ingrese la contraseña para desencriptar:",
                show="●"
            )
            if pwd is None:
                return
            
            logger.debug("Verificando contraseña para desencriptación")
            
            if self.auth.verificar_password(pwd):
                texto = self.encryption.desencriptar()
                
                self.resultado.config(state="normal")
                self.resultado.delete("1.0", tk.END)
                self.resultado.insert(tk.END, texto)
                self.resultado.config(state="disabled")
                
                messagebox.showinfo("✅ Éxito", f"Texto desencriptado correctamente\n({len(texto)} caracteres)")
                logger.info("Desencriptación exitosa")
            else:
                messagebox.showerror("❌ Error", "Contraseña incorrecta")
                logger.warning("Intento de desencriptación con contraseña incorrecta")
        
        except EncriptacionError as e:
            messagebox.showerror("❌ Error", f"No se pudo desencriptar: {str(e)}")
            logger.error(f"Error en desencriptación: {str(e)}")
    
    def ver_historial(self):
        """Mostrar historial de operaciones."""
        historial = self.encryption.obtener_historial()
        if not historial:
            messagebox.showinfo("📋 Historial", "El historial está vacío")
            return
        
        texto = "═" * 70 + "\n"
        texto += "HISTORIAL DE OPERACIONES DE ENCRIPTACIÓN\n"
        texto += "═" * 70 + "\n\n"
        
        for idx, item in enumerate(historial, 1):
            texto += f"#{idx} - {item['texto']}\n"
            texto += f"    Permutación: {item['permutacion']}\n"
            texto += "─" * 70 + "\n"
        
        messagebox.showinfo("📋 Historial", texto)
        logger.info(f"Historial consultado: {len(historial)} registros")
    
    @staticmethod
    def _formatear_matriz(matriz):
        """Formatear matriz para visualización legible."""
        import numpy as np
        matriz = np.array(matriz)
        filas, cols = matriz.shape
        
        texto = ""
        for i in range(filas):
            texto += "[ "
            for j in range(cols):
                texto += f"{matriz[i][j]:8.2f} "
            texto += "]\n"
        
        return texto
    
    def on_closing(self):
        """Manejar el cierre de la aplicación."""
        logger.info("Aplicación cerrada por el usuario")
        self.root.quit()


if __name__ == "__main__":
    logger.info("=== INICIANDO SISTEMA DE ENCRIPTACIÓN ===")
    app = InterfazEncriptador()
    logger.info("=== SISTEMA FINALIZADO ===")
