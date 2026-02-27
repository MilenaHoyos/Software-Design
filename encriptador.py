"""
Encriptador Matricial - Módulo Principal de Encriptación

Este módulo implementa un sistema de encriptación basado en álgebra lineal.
Utiliza:
  1. Matrices invertibles NxN para cifrado (multiplicación matricial)
  2. Permutaciones de columnas para seguridad adicional
  3. Conversión de caracteres a códigos Unicode

Proceso de encriptación:
  Texto → Unicode → Matriz → Multiplicación por Clave → Permutación → Cifrado

Proceso de desencriptación:
  Cifrado → Permutación Inversa → Multiplicación por Clave Inversa → Matriz → Texto
"""

from typing import Optional, Tuple, List
import numpy as np
from numpy.typing import NDArray

# ==================== EXCEPCIONES PERSONALIZADAS ====================

class MatrizInvalidaError(Exception):
    """Excepción: Matriz no es cuadrada o tiene tamaño inválido."""
    pass

class ClaveInvalidaError(Exception):
    """Excepción: Matriz no es invertible (determinante cercano a 0)."""
    pass

class PermutacionInvalidaError(Exception):
    """Excepción: Permutación no es válida."""
    pass


# ==================== CLASE PRINCIPAL: ENCRIPTADOR ====================

class Encriptador:
    """
    ╔════════════════════════════════════════════════════════════════╗
    ║         ENCRIPTADOR MATRICIAL NxN INVERTIBLE                  ║
    ╚════════════════════════════════════════════════════════════════╝
    
    Implementa un sistema de encriptación robusto basado en álgebra lineal.
    
    CARACTERÍSTICAS:
    ================
    - Matrices invertibles NxN como clave de cifrado
    - Multiplicación matricial para codificar el texto
    - Permutación de columnas para seguridad adicional
    - Conversión reversible texto ↔ Unicode ↔ Matriz
    
    EJEMPLO DE USO:
    ===============
    >>> enc = Encriptador()
    >>> cifrado = enc.encriptar("Hola")
    >>> original = enc.desencriptar(cifrado)
    >>> assert original == "Hola"  # ✓ Exitoso
    
    PARÁMETROS DEL CONSTRUCTOR:
    ============================
    - clave: Lista[Lista[float]] - Matriz NxN invertible (opcional)
    - permutacion: Tuple[int, ...] - Permutación de índices (opcional)
    """
    
    # Matriz clave por defecto (3x3 invertible)
    DEFAULT_CLAVE = [
        [2, 3, 1],
        [1, 1, 0],
        [0, 5, 2]
    ]

    def __init__(
        self,
        clave: Optional[List[List[float]]] = None,
        permutacion: Optional[Tuple[int, ...]] = None
    ) -> None:
        """
        INICIALIZAR ENCRIPTADOR
        =======================
        
        Args:
            clave: Matriz NxN invertible. Si es None, usa matriz por defecto.
            permutacion: Tupla de permutación. Si es None, usa identidad [0,1,2,...,n-1].
        
        Raises:
            MatrizInvalidaError: Si la matriz no es cuadrada.
            ClaveInvalidaError: Si la matriz no es invertible.
            PermutacionInvalidaError: Si la permutación es inválida.
        """
        # Usar clave por defecto si no se especifica
        if clave is None:
            clave = self.DEFAULT_CLAVE
        
        # Convertir a matriz numpy
        self.clave = np.array(clave, dtype=float)
        
        # ✓ VALIDAR: Matriz debe ser cuadrada
        if self.clave.shape[0] != self.clave.shape[1]:
            raise MatrizInvalidaError(f"Matriz debe ser cuadrada: {self.clave.shape}")
        
        self.n = self.clave.shape[0]
        
        # ✓ VALIDAR: Matriz debe ser invertible (determinante ≠ 0)
        det = np.linalg.det(self.clave)
        if abs(det) < 1e-6:
            raise ClaveInvalidaError(f"Determinante muy pequeño: {det}")
        
        # Calcular matriz inversa (usada en desencriptación)
        self.clave_inv = np.linalg.inv(self.clave)
        
        # ✓ VALIDAR: Permutación debe ser válida
        if permutacion is None:
            permutacion = tuple(range(self.n))
        
        if len(permutacion) != self.n or set(permutacion) != set(range(self.n)):
            raise PermutacionInvalidaError(f"Permutación inválida: {permutacion}")
        
        # Guardar permutación y su inversa
        self.permutacion = permutacion
        self.permutacion_inv = tuple(
            permutacion.index(i) for i in range(self.n)
        )

    # ==================== CONVERSION: TEXTO ↔ MATRIZ ====================

    def texto_a_matriz(self, texto: str) -> NDArray:
        """
        CONVERTIR TEXTO A MATRIZ DE UNICODE
        ====================================
        
        Proceso:
        1. Convertir cada carácter a su código Unicode (0-1114111)
        2. Agrupar en filas de tamaño n (rellenar con ceros si es necesario)
        3. Retornar como matriz numpy
        
        Args:
            texto: String a convertir.
        
        Returns:
            Matriz numpy de forma (filas, n) con códigos Unicode.
        
        Raises:
            ValueError: Si el texto es vacío o no válido.
        
        Ejemplo:
            >>> enc = Encriptador()
            >>> matriz = enc.texto_a_matriz("Hola")
            >>> print(matriz.shape)  # (2, 3) para n=3
            >>> print(matriz[0])     # [72, 111, 108] (H, o, l)
        """
        # Validar entrada
        if not texto or not isinstance(texto, str):
            raise ValueError("El texto debe ser un string no vacío")
        
        # Paso 1: Convertir texto a códigos Unicode
        nums = [ord(c) for c in texto]
        
        # Paso 2: Rellenar con ceros hasta que sea múltiplo de n
        while len(nums) % self.n != 0:
            nums.append(0)  # Padding: agregar ceros
        
        # Paso 3: Reshapear a matriz
        return np.array(nums, dtype=float).reshape(-1, self.n)

    def matriz_a_texto(self, matriz: NDArray) -> str:
        """
        CONVERTIR MATRIZ DE UNICODE A TEXTO
        ====================================
        
        Proceso:
        1. Aplanar matriz a vector
        2. Redondear a enteros (necesario después de operaciones matriciales)
        3. Remover padding (ceros al final)
        4. Convertir códigos a caracteres
        
        Args:
            matriz: Matriz numpy con códigos Unicode.
        
        Returns:
            String recuperado.
        
        Raises:
            ValueError: Si hay error en conversión.
        
        Ejemplo:
            >>> matriz = np.array([[72, 111], [108, 97]])
            >>> texto = enc.matriz_a_texto(matriz)
            >>> print(texto)  # "Hola"
        """
        try:
            # Paso 1: Aplanar matriz
            nums = np.array(matriz, dtype=float).flatten()
            
            # Paso 2: Redondear a enteros (importante para precisión numérica)
            nums = np.rint(nums).astype(int)
            
            # Paso 3: Remover padding (ceros al final)
            while len(nums) > 0 and nums[-1] == 0:
                nums = nums[:-1]
            
            # Paso 4: Convertir a caracteres
            return ''.join(chr(i) for i in nums)
        
        except Exception as e:
            raise ValueError(f"Error en conversión de matriz a texto: {str(e)}") from e

    # ==================== ENCRIPTACIÓN ====================

    def encriptar(self, texto: str) -> NDArray:
        """
        ENCRIPTAR TEXTO
        ===============
        
        Proceso matemático:
        1. Convertir texto a matriz M de tamaño (filas, n)
        2. Multiplicar: C = M × K (donde K es la clave invertible)
        3. Aplicar permutación: C_permutado = C[:, permutacion]
        
        Args:
            texto: Texto plano a encriptar.
        
        Returns:
            Matriz cifrada (números grandes y aparentemente aleatorios).
        
        Raises:
            ValueError: Si el texto es inválido.
        
        Ejemplo:
            >>> enc = Encriptador()
            >>> cifrado = enc.encriptar("Hola")
            >>> print(cifrado.shape)  # Matriz de números
        """
        # Convertir texto a matriz
        matriz = self.texto_a_matriz(texto)
        
        # Multiplicación matricial: M × K
        cifrada = np.dot(matriz, self.clave)
        
        # Aplicar permutación de columnas
        cifrada = cifrada[:, self.permutacion]
        
        return cifrada

    # ==================== DESENCRIPTACIÓN ====================

    def desencriptar(self, cifrada: NDArray) -> str:
        """
        DESENCRIPTAR MATRIZ
        ===================
        
        Proceso matemático (INVERSO de encriptación):
        1. Aplicar permutación inversa: C_original = Cifrado[:, permutacion_inversa]
        2. Multiplicar por matriz inversa: M = C_original × K^(-1)
        3. Convertir matriz a texto
        
        Args:
            cifrada: Matriz encriptada (resultado de encriptar).
        
        Returns:
            Texto original descifrado.
        
        Raises:
            ValueError: Si la matriz tiene dimensiones incorrectas.
        
        Ejemplo:
            >>> enc = Encriptador()
            >>> cifrado = enc.encriptar("Hola")
            >>> original = enc.desencriptar(cifrado)
            >>> assert original == "Hola"
        """
        # Convertir a array numpy
        arr = np.array(cifrada, dtype=float)
        
        # Validar dimensiones
        if arr.shape[1] != self.n:
            raise ValueError(
                f"Número de columnas incorrecto: {arr.shape[1]} vs {self.n}"
            )
        
        # Paso 1: Invertir permutación
        original = arr[:, self.permutacion_inv]
        
        # Paso 2: Multiplicar por matriz inversa: C × K^(-1)
        original = np.dot(original, self.clave_inv)
        
        # Paso 3: Convertir matriz a texto
        return self.matriz_a_texto(original)


# ==================== BLOQUE DE PRUEBA ====================

if __name__ == "__main__":
    """
    PRUEBA MANUAL DEL ENCRIPTADOR
    ==============================
    Ejecuta: python encriptador.py
    """
    try:
        # Crear encriptador con matriz por defecto
        enc = Encriptador()
        
        # Solicitar texto al usuario
        texto = input("📝 Ingrese texto a encriptar: ").strip()
        
        if texto:
            # Encriptar
            print("\n🔒 Encriptando...")
            cif = enc.encriptar(texto)
            
            print("\n🔐 Matriz cifrada:")
            print(cif)
            print(f"Forma: {cif.shape}")
            
            # Desencriptar
            print("\n🔓 Desencriptando...")
            original = enc.desencriptar(cif)
            
            print("\n📄 Texto recuperado:")
            print(original)
            
            # Verificar
            estado = "✓ OK" if original == texto else "✗ FALLO"
            print(f"\n✓ Verificación: {estado}")
            
            if original == texto:
                print("El sistema funciona correctamente!")
            else:
                print("⚠️ Hay un error en el sistema")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")

    """
    Sistema de encriptación matricial NxN.

    Usa una matriz clave NxN invertible para cifrar texto.
    Convierte caracteres a Unicode, los agrupa en bloques,
    multiplica por la clave y aplica permutación de columnas.
    
    Ejemplo:
        >>> enc = Encriptador()
        >>> cifrado = enc.encriptar("Hola")
        >>> original = enc.desencriptar(cifrado)
        >>> assert original == "Hola"
    """
    
    DEFAULT_CLAVE = [
        [2, 3, 1],
        [1, 1, 0],
        [0, 5, 2]
    ]

    def __init__(
        self,
        clave: Optional[List[List[float]]] = None,
        permutacion: Optional[Tuple[int, ...]] = None
    ) -> None:
        """Inicializar encriptador."""
        if clave is None:
            clave = self.DEFAULT_CLAVE
        
        self.clave = np.array(clave, dtype=float)
        
        # Validar cuadrada
        if self.clave.shape[0] != self.clave.shape[1]:
            raise MatrizInvalidaError(f"Matriz debe ser cuadrada: {self.clave.shape}")
        
        self.n = self.clave.shape[0]
        
        # Validar invertible
        det = np.linalg.det(self.clave)
        if abs(det) < 1e-6:
            raise ClaveInvalidaError(f"Determinante: {det}")
        
        self.clave_inv = np.linalg.inv(self.clave)
        
        # Validar permutación
        if permutacion is None:
            permutacion = tuple(range(self.n))
        
        if len(permutacion) != self.n or set(permutacion) != set(range(self.n)):
            raise PermutacionInvalidaError(f"Inválida: {permutacion}")
        
        self.permutacion = permutacion
        self.permutacion_inv = tuple(
            permutacion.index(i) for i in range(self.n)
        )

    def texto_a_matriz(self, texto: str) -> NDArray:
        """Convertir texto a matriz de Unicode."""
        if not texto or not isinstance(texto, str):
            raise ValueError("Texto inválido")
        
        nums = [ord(c) for c in texto]
        while len(nums) % self.n != 0:
            nums.append(0)
        
        return np.array(nums, dtype=float).reshape(-1, self.n)

    def matriz_a_texto(self, matriz: NDArray) -> str:
        """Convertir matriz de Unicode a texto."""
        try:
            nums = np.array(matriz, dtype=float).flatten()
            nums = np.rint(nums).astype(int)
            
            while len(nums) > 0 and nums[-1] == 0:
                nums = nums[:-1]
            
            return ''.join(chr(i) for i in nums)
        except Exception as e:
            raise ValueError(f"Conversión inválida: {str(e)}") from e

    def encriptar(self, texto: str) -> NDArray:
        """Encriptar texto."""
        matriz = self.texto_a_matriz(texto)
        cifrada = np.dot(matriz, self.clave)
        cifrada = cifrada[:, self.permutacion]
        return cifrada

    def desencriptar(self, cifrada: NDArray) -> str:
        """Desencriptar matriz."""
        arr = np.array(cifrada, dtype=float)
        
        if arr.shape[1] != self.n:
            raise ValueError(f"Columnas incorrectas: {arr.shape[1]} vs {self.n}")
        
        original = arr[:, self.permutacion_inv]
        original = np.dot(original, self.clave_inv)
        
        return self.matriz_a_texto(original)


# Test
if __name__ == "__main__":
    try:
        enc = Encriptador()
        texto = input("Texto: ").strip()
        
        if texto:
            cif = enc.encriptar(texto)
            print("\nMatriz cifrada:")
            print(cif)
            
            original = enc.desencriptar(cif)
            print("\nDesencriptado:", original)
            print(f"Verificación: {'✓ OK' if original == texto else '✗ FALLO'}")
    except Exception as e:
        print(f"Error: {e}")
