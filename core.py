import logging
import math
from typing import Tuple, Optional, Dict, Any, List
import numpy as np
from numpy.typing import NDArray

class EncriptacionError(Exception):
    """Excepción base para errores de encriptación."""
    pass

class MatrizInvalidaError(EncriptacionError):
    """Excepción: Matriz con forma o contenido inválido."""
    pass

class ClaveInvalidaError(EncriptacionError):
    """Excepción: Matriz no invertible (determinante ≈ 0)."""
    pass

class PermutacionInvalidaError(EncriptacionError):
    """Excepción: Permutación no válida."""
    pass

class DesencriptacionError(EncriptacionError):
    """Excepción: Error durante la desencriptación."""
    pass

class AutenticacionError(Exception):
    """Excepción: Fallo de autenticación o límite de intentos alcanzado."""
    pass

# ==================== SISTEMA DE LOGGING ====================

def obtener_logger(nombre: str) -> logging.Logger:
    """
    OBTENER LOGGER CONFIGURADO
    ==========================
    
    Crea o retorna un logger con configuración estándar.
    Incluye timestamp, nombre del módulo, nivel y mensaje.
    
    Args:
        nombre: Nombre del módulo logger (típicamente __name__).
    
    Returns:
        Logger configurado y listo para usar.
    
    Ejemplo:
        >>> logger = obtener_logger(__name__)
        >>> logger.info("Sistema iniciado")
        >>> # Output: 2024-01-15 10:30:45,123 - __main__ - INFO - Sistema iniciado
    """
    logger = logging.getLogger(nombre)
    
    # Evitar agregar múltiples handlers al mismo logger
    if not logger.handlers:
        # Configurar formato: [timestamp] - [módulo] - [nivel] - [mensaje]
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    
    return logger

# Instancia global del logger para este módulo
logger = obtener_logger(__name__)

# ==================== SERVICIO DE AUTENTICACIÓN ====================

class ServicioAutenticacion:
    """
    ╔═══════════════════════════════════════════════════════╗
    ║         GESTOR DE AUTENTICACIÓN Y SEGURIDAD           ║
    ╚═══════════════════════════════════════════════════════╝
    
    Responsabilidades:
    ===================
    1. Validar credenciales (usuario y contraseña)
    2. Limitar intentos de acceso (MAX_INTENTOS = 3)
    3. Registrar intentos en log para auditoría
    4. Mantener estado de intentos fallidos
    
    FLUJO DE SEGURIDAD:
    ===================
    Intento 1 (Fallo)  → intentos_fallidos = 1 → 2 intentos restantes ⚠️
    Intento 2 (Fallo)  → intentos_fallidos = 2 → 1 intento restante ⚠️⚠️
    Intento 3 (Éxito)  → intentos_fallidos = 0 → BLOQUEADO ✓ (reinicia contador)
    Intento 3 (Fallo)  → intentos_fallidos = 3 → BLOQUEADO ❌
    
    Intentos adicionales: Levanta AutenticacionError
    
    Credenciales por defecto:
    =========================
    Usuario: "Mile"
    Password: "1234"
    """
    
    def __init__(
        self,
        usuario: str = USUARIO_DEFECTO,
        password: str = PASSWORD_DEFECTO
    ) -> None:
        """
        INICIALIZAR SERVICIO DE AUTENTICACIÓN
        ======================================
        
        Args:
            usuario: Nombre de usuario válido. Default: "Mile"
            password: Contraseña correcta. Default: "1234"
        
        Attributes:
            usuario: Nombre de usuario esperado
            password: Contraseña esperada
            intentos_fallidos: Contador de intentos fallidos (0-3)
        """
        self.usuario = usuario
        self.password = password
        self.intentos_fallidos = 0
        logger.info(f"Servicio de autenticación inicializado para usuario '{usuario}'")
    
    def autenticar(self, usuario: str, password: str) -> bool:
        """
        AUTENTICAR USUARIO
        ==================
        
        Valida un intento de acceso. Si el usuario ingresa credenciales
        correctas, se reinicia el contador de intentos. Si falla, suma
        un intento y retorna False.
        
        CASOS:
        ======
        ✓ Credenciales correctas:
          - Retorna True
          - Reinicia intentos_fallidos a 0
          - Registra: "Usuario 'X' autenticado"
        
        ✗ Credenciales incorrectas:
          - Incrementa intentos_fallidos
          - Si < MAX_INTENTOS: Levanta AutenticacionError con intentos restantes
          - Si = MAX_INTENTOS: Levanta AutenticacionError bloqueado
        
        Args:
            usuario: Usuario a autenticar
            password: Contraseña a verificar
        
        Returns:
            bool: True si las credenciales son correctas
        
        Raises:
            AutenticacionError: Si credenciales fallan o se alcanza MAX_INTENTOS
        
        Ejemplo:
            >>> auth = ServicioAutenticacion()
            >>> try:
            ...     auth.autenticar("Mile", "1234")  # ✓
            ...     print("Acceso permitido")
            ... except AutenticacionError:
            ...     print("Acceso denegado")
        """
        # Verificación 1: ¿Ya se alcanzó el límite de intentos?
        if self.intentos_fallidos >= MAX_INTENTOS:
            msg = f"❌ BLOQUEADO: Máximo de {MAX_INTENTOS} intentos excedido"
            logger.warning(msg)
            raise AutenticacionError(msg)
        
        # Verificación 2: ¿Las credenciales son correctas?
        if usuario == self.usuario and password == self.password:
            # ✓ ÉXITO: Reiniciar contador y retornar True
            self.intentos_fallidos = 0
            logger.info(f"✓ Usuario '{usuario}' autenticado exitosamente")
            return True
        else:
            # ✗ ERROR: Incrementar contador de intentos
            self.intentos_fallidos += 1
            restantes = MAX_INTENTOS - self.intentos_fallidos
            
            # Crear mensaje informativo
            msg = f"❌ Credenciales inválidas. Intentos restantes: {restantes}"
            logger.warning(f"Intento fallido #{self.intentos_fallidos} "
                         f"para usuario '{usuario}'")
            
            raise AutenticacionError(msg)
    
    def verificar_password(self, password: str) -> bool:
        """
        VERIFICAR CONTRASEÑA
        ====================
        
        Comprueba si una contraseña coincide sin registrar el intento.
        Útil para cambios de contraseña o verificaciones silenciosas.
        
        Args:
            password: Contraseña a verificar
        
        Returns:
            bool: True si coincide con la contraseña,False en caso contrario
        
        Nota:
            Esta función NO incrementa el contador de intentos fallidos.
        """
        return password == self.password

# ==================== SERVICIO DE ENCRIPTACIÓN ====================

class ServicioEncriptacion:
    """
    ╔═══════════════════════════════════════════════════════╗
    ║    GESTOR DE ENCRIPTACIÓN Y GENERACIÓN DE CLAVES     ║
    ╚═══════════════════════════════════════════════════════╝
    
    Responsabilidades:
    ===================
    1. Generar matrices invertibles aleatorias
    2. Generar permutaciones aleatorias
    3. Ejecutar procesos de encriptación
    4. Mantener estado de encriptación actual
    5. Gestionar historial de operaciones
    
    ATRIBUTOS CLAVE:
    ================
    encriptador_actual: Instancia del Encriptador en uso
    cifrado_actual: Última matriz encriptada generada
    clave_actual: Última clave generada
    permutacion_actual: Última permutación aplicada
    historial: Lista de operaciones realizadas
    
    OPERACIÓN TÍPICA:
    =================
    1. Usuario escribe: "Hola Mundo" (11 caracteres)
    2. Sistema calcula n = ceil(sqrt(11)) = 4
    3. Genera matriz aleatoria 4×4 invertible
    4. Genera permutación aleatoria (0,1,2,3) → (2,0,3,1)
    5. Crea Encriptador con esa clave y permutación
    6. Encripta el texto → matriz de números grandes
    7. Almacena en historial
    8. Usuario puede desencriptar después
    """
    
    def __init__(self) -> None:
        """
        INICIALIZAR SERVICIO DE ENCRIPTACIÓN
        =====================================
        
        Attributes iniciales:
            encriptador_actual: None (sin encriptación activa)
            cifrado_actual: None (sin resultado)
            clave_actual: None (sin clave generada)
            permutacion_actual: None (sin permutación)
            historial: [] (lista vacía)
        """
        self.encriptador_actual: Optional[Any] = None
        self.cifrado_actual: Optional[NDArray] = None
        self.clave_actual: Optional[NDArray] = None
        self.permutacion_actual: Optional[Tuple] = None
        self.historial: List[Dict[str, Any]] = []
        logger.info("Servicio de encriptación inicializado")
    
    def _generar_clave(self, n: int) -> NDArray:
        """
        GENERAR MATRIZ INVERTIBLE ALEATORIA
        ====================================
        
        Genera una matriz NxN con valores aleatorios entre 1-8 que sea
        invertible (determinante > DTERMINANTE_MIN). Realiza hasta 100
        intentos antes de rendirse.
        
        PROCESO:
        ========
        1. Generar matriz aleatoria (n×n) con valores en [1, 9)
        2. Calcular determinante
        3. Si |det| > DTERMINANTE_MIN → Retorna matriz
        4. Si |det| ≈ 0 → Intenta de nuevo (máx 100 veces)
        
        Args:
            n: Tamaño de la matriz (n×n)
        
        Returns:
            NDArray: Matriz invertible de forma (n, n)
        
        Raises:
            EncriptacionError: Si no logra generar matriz invertible
        
        Ejemplo:
            >>> enc = ServicioEncriptacion()
            >>> clave = enc._generar_clave(3)
            >>> print(det(clave))  # > 0.000001
        
        Nota matemática:
            Una matriz es invertible ⟺ det(A) ≠ 0
            DTERMINANTE_MIN = 1e-6 protege contra problemas numéricos
        """
        # Intentar hasta 100 veces generar matriz invertible
        for intento in range(100):
            # Generar matriz aleatoria 1-8
            matriz = np.random.randint(1, 9, size=(n, n))
            
            # Calcular determinante
            det = np.linalg.det(matriz)
            
            # Validar invertibilidad
            if abs(det) > DTERMINANTE_MIN:
                logger.debug(f"Clave {n}×{n} generada en intento {intento+1} "
                           f"(det={det:.6f})")
                return matriz
        
        # No se logró generar clave invertible
        msg = "No se pudo generar matriz invertible después de 100 intentos"
        logger.error(msg)
        raise EncriptacionError(msg)
    
    def encriptar(self, texto: str, encriptador) -> Dict[str, Any]:
        """
        ENCRIPTAR TEXTO
        ===============
        
        Procesa un texto plano completando estos pasos:
        1. Validar que el texto no esté vacío
        2. Calcular n = ceil(sqrt(len(texto)))
        3. Generar clave invertible n×n
        4. Generar permutación aleatoria de [0, 1, ..., n-1]
        5. Crear instancia de Encriptador
        6. Ejecutar encriptación
        7. Almacenar estado y historial
        
        Args:
            texto: String a encriptar
            encriptador: Clase Encriptador (ej: from encriptador import Encriptador)
        
        Returns:
            Dict con:
                'texto': Texto original
                'unicode': Lista de códigos Unicode de cada carácter
                'clave': Matriz clave generada (n×n)
                'permutacion': Tupla de permutación aplicada
                'cifrado': Matriz resultado de encriptación
        
        Raises:
            ValueError: Si el texto es vacío
            EncriptacionError: Si falla la generación de clave
        
        Ejemplo:
            >>> from encriptador import Encriptador
            >>> enc_svc = ServicioEncriptacion()
            >>> resultado = enc_svc.encriptar("Hola", Encriptador)
            >>> print(resultado['unicode'])       # [72, 111, 108, 97]
            >>> print(resultado['cifrado'].shape) # (2, 2)
        
        DATOS ALMACENADOS:
        ==================
        Después de encriptar, el servicio guarda:
        - estado: encriptador_actual, cifrado_actual, clave_actual, permutacion_actual
        - historial: Entrada con texto, codes unicode y permutación usada
        
        Esto permite desencriptar() después sin parámetros
        """
        try:
            # Paso 1: Validar entrada
            if not texto or not isinstance(texto, str) or not texto.strip():
                raise ValueError("El texto debe ser un string no vacío")
            
            logger.info(f"Iniciando encriptación de {len(texto)} caracteres")
            
            # Paso 2: Calcular tamaño de matriz
            # n debe ser al menos ceil(sqrt(len(texto))) para que quepa el texto
            n = max(2, math.ceil(math.sqrt(len(texto))))
            logger.debug(f"Tamaño de matriz calculado: {n}×{n}")
            
            # Paso 3: Generar clave invertible
            clave = self._generar_clave(n)
            logger.debug(f"Clave generada: det={np.linalg.det(clave):.6f}")
            
            # Paso 4: Generar permutación aleatoria
            permutacion = tuple(np.random.permutation(n))
            logger.debug(f"Permutación generada: {permutacion}")
            
            # Paso 5: Crear encriptador
            enc = encriptador(clave.tolist(), permutacion)
            logger.debug("Instancia de Encriptador creada")
            
            # Paso 6: Ejecutar encriptación
            cifrado = enc.encriptar(texto)
            logger.info("✓ Encriptación exitosa")
            
            # Paso 7: Guardar estado
            self.encriptador_actual = enc
            self.cifrado_actual = cifrado
            self.clave_actual = clave
            self.permutacion_actual = permutacion
            
            # Convertir caracteres a códigos Unicode
            unicode_codes = [ord(c) for c in texto]
            
            # Paso 8: Agregar al historial
            self.historial.append({
                "texto": texto,
                "unicode": unicode_codes,
                "permutacion": permutacion,
                "timestamp": logger.handlers[0].formatter.formatTime(
                    logging.LogRecord(
                        name=__name__,
                        level=logging.INFO,
                        pathname="",
                        lineno=0,
                        msg="",
                        args=(),
                        exc_info=None
                    )
                ) if logger.handlers else "unknown"
            })
            
            # Retornar información completa
            return {
                "texto": texto,
                "unicode": unicode_codes,
                "clave": clave,
                "permutacion": permutacion,
                "cifrado": cifrado
            }
        
        except Exception as e:
            logger.error(f"❌ Error en encriptación: {str(e)}")
            raise EncriptacionError(f"Error: {str(e)}") from e
    
    def desencriptar(self) -> str:
        """
        DESENCRIPTAR MATRIZ ACTUAL
        ==========================
        
        Desencripta el cifrado_actual usando el encriptador_actual.
        Requiere que previamente se haya ejecutado encriptar().
        
        PROCESO:
        ========
        1. Validar que existe encriptación activa
        2. Llamar a encriptador_actual.desencriptar(cifrado_actual)
        3. Retornar texto original
        
        Returns:
            str: Texto desencriptado
        
        Raises:
            EncriptacionError: Si no hay encriptación activa
            DesencriptacionError: Si falla el proceso de desencriptación
        
        Ejemplo:
            >>> enc_svc = ServicioEncriptacion()
            >>> resultado = enc_svc.encriptar("Secreto", Encriptador)
            >>> original = enc_svc.desencriptar()
            >>> assert original == "Secreto"  # ✓
        
        Nota:
            Requiere encriptación previa. Si llamas sin encriptar,
            levanta: EncriptacionError("No hay encriptación activa")
        """
        # Validación: ¿Hay encriptación activa?
        if self.encriptador_actual is None or self.cifrado_actual is None:
            msg = "⚠️ No hay encriptación activa. Encripta primero."
            logger.warning(msg)
            raise EncriptacionError(msg)
        
        try:
            logger.info("Iniciando desencriptación")
            
            # Ejecutar desencriptación
            texto = self.encriptador_actual.desencriptar(self.cifrado_actual)
            
            logger.info(f"✓ Desencriptación exitosa: {len(texto)} caracteres")
            return texto
        
        except Exception as e:
            logger.error(f"❌ Error en desencriptación: {str(e)}")
            raise DesencriptacionError(str(e)) from e
    
    def obtener_historial(self) -> List[Dict]:
        """
        OBTENER HISTORIAL DE ENCRIPTACIONES
        ====================================
        
        Retorna la lista completa de operaciones de encriptación
        realizadas en esta sesión.
        
        Returns:
            List[Dict]: Lista de diccionarios con:
                - 'texto': Texto encriptado
                - 'unicode': Códigos Unicode
                - 'permutacion': Permutación usada
                - 'timestamp': Momento de la operación
        
        Nota:
            El historial se reiniza cada vez que se crea una nueva
            instancia de ServicioEncriptacion
        """
        return self.historial
    
    def tiene_encriptacion_activa(self) -> bool:
        """
        VERIFICAR ENCRIPTACIÓN ACTIVA
        =============================
        
        Comprueba si existe una encriptación actual que pueda
        desencriptarse.
        
        Returns:
            bool: True si hay encriptación activa, False en caso contrario
        
        Ejemplo:
            >>> enc_svc = ServicioEncriptacion()
            >>> enc_svc.tiene_encriptacion_activa()  # False
            >>> enc_svc.encriptar("Hola", Encriptador)
            >>> enc_svc.tiene_encriptacion_activa()  # True
        """
        return (self.encriptador_actual is not None and
                self.cifrado_actual is not None)
