# 🔐 GUÍA DE PRESENTACIÓN - ENCRIPTADOR MATRICIAL

## 1. INTRODUCCIÓN AL PROYECTO

### ¿Qué es este sistema?
Un **encriptador basado en álgebra lineal** que utiliza matrices invertibles NxN para cifrar textos de manera segura.

### ¿Cómo funciona el concepto?
```
TEXTO PLANO → Unicode → MATRIZ → Multiplicación Matricial → CIFRADO
"Hola"                   M        M × Clave (K)            Cifrado
↓
CIFRADO → Permutación Inversa → Multiplicación por K⁻¹ → MATRIZ → TEXTO
Resultado                        Recuperación                         "Hola"
```

---

## 2. COMPONENTES DEL SISTEMA

### 📦 Estructura de archivos
```
Sistema De Encriptacion/
├── main.py ....................... Punto de entrada (1 función)
├── interfaz.py ................... Interfaz gráfica con tkinter
├── encriptador.py ................ Lógica de encriptación (Clase: Encriptador)
├── core.py ....................... Servicios y configuración central
├── tests.py ...................... 11 pruebas unitarias
├── README.md ..................... Documentación del proyecto
└── GUIA_PRESENTACION.md .......... Este archivo
```

### 🔧 Módulos principales

#### 1. **encriptador.py** - Lógica Matemática
**Responsabilidad**: Encriptación matemática usando álgebra lineal

```python
class Encriptador:
    # Métodos principales
    texto_a_matriz(texto)          # "Hola" → [[72, 111], [108, 97]]
    matriz_a_texto(matriz)         # Inverso
    encriptar(texto)               # Texto → Matriz cifrada
    desencriptar(cifrada)          # Matriz cifrada → Texto
```

**Conceptos importantes**:
- `DEFAULT_CLAVE`: Matriz 3×3 invertible por defecto
- `det(K) ≠ 0`: La clave debe ser invertible
- `K⁻¹`: Matriz inversa para desencriptación
- **Permutación**: Cambia orden de columnas (seguridad adicional)

---

#### 2. **core.py** - Servicios y Configuración
**Responsabilidad**: Gestión centralizada de servicios

**Configuración global**:
```python
USUARIO_DEFECTO = "Mile"          # Usuario de prueba
PASSWORD_DEFECTO = "1234"         # Contraseña de prueba
MAX_INTENTOS = 3                  # Intentos fallidos permitidos
TAMAÑO_VENTANA = "900x800"        # Dimensiones interfaz
```

**Excepciones**:
```
EncriptacionError
├── MatrizInvalidaError ........... Matriz no cuadrada
├── ClaveInvalidaError ............ No invertible
├── PermutacionInvalidaError ...... Permutación inválida
└── DesencriptacionError .......... Fallo en desencriptación

AutenticacionError ................ Credenciales fallidas
```

**Servicio: ServicioAutenticacion**
```python
autenticar(usuario, password)     # Validar credenciales
verificar_password(password)      # Chequeo silencioso
# Control: MAX_INTENTOS = 3 intentos antes de bloquear
```

**Servicio: ServicioEncriptacion**
```python
encriptar(texto, Encriptador)     # Encriptar texto
desencriptar()                    # Desencriptar cifrado actual
obtener_historial()               # Ver todas las operaciones
tiene_encriptacion_activa()       # ¿Hay datos para desencriptar?
_generar_clave(n)                 # Generar matriz invertible aleatoria
```

---

#### 3. **interfaz.py** - Interfaz Gráfica
**Responsabilidad**: Usuario interactúa con el sistema

**Flujo de interfaz**:

```
INICIO
  │
  └─→ show_login()
      ├─ Pide usuario/password
      ├─ Valida credenciales
      └─ Si OK → show_main()
           │
           ├─ Sección entrada: TextBox para ingresar texto
           │
           ├─ Botones:
           │  ├─ [ENCRIPTAR] → llama a encriptar()
           │  ├─ [DESENCRIPTAR] → llama a desencriptar()
           │  └─ [VER HISTORIAL] → muestra que se ha encriptado
           │
           └─ Resultados (5 panes):
              ├─ 1️⃣ Códigos Unicode
              ├─ 2️⃣ Matriz de entrada
              ├─ 3️⃣ Clave generada (K)
              ├─ 4️⃣ Permutación usada
              └─ 5️⃣ Matriz cifrada
```

**Colores utilizados**:
- `#f0f0f0` (Gris claro) - Fondo
- `#1e3a8a` (Azul oscuro) - Títulos
- `#3b82f6` (Azul claro) - Botones

---

## 3. WALKTHROUGH DE DEMOSTRACIÓN

### Demo 1: Encriptación simple

```
PASO 1: Iniciar aplicación
$ python main.py

PASO 2: Login
┌─────────────────────────────────┐
│ 🔐 Autenticación                │
│                                 │
│ Usuario: Mile                   │
│ Password: 1234                  │
│ [Aceptar]                       │
└─────────────────────────────────┘

PASO 3: Ingresa texto
┌──────────────────────────────────────────┐
│ 📝 Ingrese texto a encriptar:           │
│                                          │
│ [    Hola    ]                          │
│                                          │
│ [ENCRIPTAR] [DESENCRIPTAR] [HISTORIAL]  │
└──────────────────────────────────────────┘

PASO 4: Sistema revela el proceso

1️⃣ CÓDIGOS UNICODE:
   "Hola" → [72, 111, 108, 97]

2️⃣ MATRIZ DE ENTRADA:
   [[72, 111]
    [108, 97]]

3️⃣ CLAVE GENERADA (K - 2×2 invertible):
   [[3, 2]
    [1, 4]]
   det(K) = 10 ✓ Invertible

4️⃣ PERMUTACIÓN APLICADA:
   (1, 0)  ← Cambia orden de columnas

5️⃣ MATRIZ CIFRADA:
   [[509, 504]
    [439, 443]]

PASO 5: Desencriptar
[DESENCRIPTAR] → "Hola" ✓ Recuperado
```

---

### Demo 2: Explicar la matemática

**Encriptación - Ecuación:**
```
Acción                    Notación
───────────────────────────────────
Matriz entrada            M (2×2)
Multiplicar por clave     C = M × K
Aplicar permutación       C' = C[:, permutación]
─────────────────────────────────
Resultado: C' es el cifrado
```

**Algebraicamente**:
```
Si K = [[2, 3],       entonces K⁻¹ = [[0.4,  -0.6],
        [1, 1]]                        [-0.2,  0.4]]

Desencriptación:
  M = C' × K⁻¹  (matriz inversa revierte la encriptación)
```

---

## 4. CONCEPTOS CLAVE PARA EXPLICAR

### 🔐 ¿Por qué matrices invertibles?

Una matriz es invertible si tiene determinante ≠ 0:
- **SI**: det(K) = 10 → Existe K⁻¹ ✓
- **NO**: det(K) = 0 → No existe K⁻¹ ✗ (No se puede desencriptar)

El sistema genera matrices aleatorias hasta encontrar una invertible.

### 📊 ¿Qué es el determinante?

Para matriz 2×2:
```
K = [[a, b],     det(K) = ad - bc
     [c, d]]
```

El determinante determina si K es invertible (det ≠ 0).

### 🔀 ¿Qué hace la permutación?

Reordena las columnas para seguridad adicional:
```
Matriz cifrada:              Después permutación (1,0):
[[A, B]      PERMUTACIÓN    [[B, A]
 [C, D]]  ────────────>      [D, C]]
```

Hace más difícil predecir el patrón sin conocer la permutación.

### 📈 ¿Cómo escala con textos largos?

```
Texto: "Hola Mundo Python 123"  (20 caracteres)
n = ceil(sqrt(20)) = 5
Matriz: 5×5 (25 espacios)
Padding: Completa con ceros hasta matriz 5×5
```

---

## 5. PRUEBAS UNITARIAS

El sistema incluye **11 pruebas unitarias** que verifican:

```
TestEncriptador (3 tests):
  ✓ Encriptar y desencriptar (roundtrip)
  ✓ Rechazar matrices no invertibles
  ✓ Soportar caracteres especiales (Unicode)

TestAutenticacion (4 tests):
  ✓ Login válido
  ✓ Login inválido
  ✓ Límite de intentos (MAX_INTENTOS=3)
  ✓ Verificación de contraseña

TestServicioEncriptacion (4 tests):
  ✓ Sin encriptación activa al inicio
  ✓ Encriptar por servicio
  ✓ Desencriptar después de encriptar
  ✓ Historial de encriptaciones
```

### Ejecutar pruebas:
```bash
$ python tests.py
Ran 11 tests in 0.012s
OK ✓
```

---

## 6. ARQUITECTURA Y DISEÑO

### Patrón de servicios

```
┌─────────────────────────────────────────┐
│          InterfazEncriptador            │
│         (interfaz.py)                   │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────────────┐
        │                     │
        ▼                     ▼
 ┌─────────────┐       ┌──────────────┐
 │  Servicio   │       │  Servicio    │
 │  Autentica- │       │  Encriptació │
 │  ción       │       │  n           │
 │ (core.py)   │       │ (core.py)    │
 └──────┬──────┘       └────────┬─────┘
        │                       │
        │              ┌────────▼────────┐
        │              │  Encriptador    │
        │              │ (encriptador.py)│
        │              └─────────────────┘
        │                       │
        │         ┌─────────────┴──────────┐
        │         │                        │
        ▼         ▼                        ▼
    Numpy    Algebra Lineal        Permutaciones
   (det, inv)  (M × K)            (orden columnas)
```

### SOLID Principles aplicados

```
S - Single Responsibility
  ✓ Encriptador: Solo encriptación matemática
  ✓ ServicioAutenticacion: Solo autenticación
  ✓ ServicioEncriptacion: Solo gestión encriptación
  ✓ InterfazEncriptador: Solo interfaz usuario

O - Open/Closed
  ✓ Excepciones: Jerarquía extensible

L - Liskov Substitution
  ✓ Todas las excepciones heredan correctamente

I - Interface Segregation
  ✓ Métodos específicos en cada servicio

D - Dependency Inversion
  ✓ core.py es módulo central independiente
```

---

## 7. DATOS Y ESTADÍSTICAS

### Complejidad algorítmica

| Operación | Complejidad | Detalle |
|-----------|------------|---------|
| texto_a_matriz | O(n) | Recorre cada carácter |
| Multiplicación matricial | O(n³) | Numpy optimizado |
| Determinante | O(n³) | Numpy optimizado |
| Inversa | O(n³) | Numpy optimizado |
| Permutación | O(n) | Reorden de columnas |
| **Total encriptación** | **O(n³)** | Dominado por álgebra lineal |

### Tamaño del proyecto

```
Total líneas de código: ~800
- encriptador.py: 250 líneas
- core.py: 350 líneas
- interfaz.py: 370 líneas
- tests.py: 150 líneas
- main.py: 50 líneas

Documentación: ~600 líneas (docstrings + comentarios)
```

---

## 8. DEMO INTERACTIVO - SCRIPT

```python
# Demostraciones que pueden hacer en vivo:

# Demo 1: Encriptación directa sin interfaz
from encriptador import Encriptador

enc = Encriptador()
cifrado = enc.encriptar("Hola")
print(cifrado)          # Matriz de números
original = enc.desencriptar(cifrado)
assert original == "Hola"    # ✓ Funciona

# Demo 2: Con servicios
from core import ServicioEncriptacion
from encriptador import Encriptador

svc = ServicioEncriptacion()
resultado = svc.encriptar("Secreto", Encriptador)

print("Unicode:", resultado['unicode'])
print("Clave:\n", resultado['clave'])
print("Permutación:", resultado['permutacion'])
print("Cifrado:\n", resultado['cifrado'])

desencriptado = svc.desencriptar()
assert desencriptado == "Secreto"  # ✓

# Demo 3: Con autenticación
from core import ServicioAutenticacion

auth = ServicioAutenticacion()
try:
    auth.autenticar("Mile", "1234")  # ✓
    print("Acceso permitido")
except:
    print("Acceso denegado")
```

---

## 9. PREGUNTAS Y RESPUESTAS ESPERADAS

### P: ¿Cómo de seguro es este sistema?
**R**: Es educativo. La seguridad real requiere:
- Matrices mucho más grandes
- Números primos grandes (RSA)
- Protocolos criptográficos estándar (AES, SHA)

### P: ¿Qué pasa si la clave no es invertible?
**R**: ClaveInvalidaError es levantado. El sistema genera claves hasta 100 veces para asegurar invertibilidad.

### P: ¿Puedo cambiar la matriz clave?
**R**: Sí, pasa una clave personalizada a Encriptador():
```python
mi_clave = [[2,3,1], [1,1,0], [0,5,2]]
enc = Encriptador(mi_clave)
```

### P: ¿Qué pasa si olvido la permutación?
**R**: Sin la permutación exacta, desencriptación falla. Es almacenada en historial.

### P: ¿Por qué limite de 3 intentos?
**R**: Seguridad: Previene ataques de fuerza bruta.

---

## 10. MEJORAS FUTURAS POSIBLES

```
✓ Completado
· Propuesto
─────────────────────────────────

✓ Encriptación básica
· Encriptación de archivos completos
· Interfaz web con Flask
· Base de datos de claves
· Firma digital (RSA)
· Generador de QR para compartir claves
· Soporte para múltiples usuarios
· Interfaz móvil (Android/iOS)
· Integración con nube (AWS S3)
```

---

## 11. INSTRUCCIONES DE EJECUCIÓN

### Requisitos
```bash
Python 3.8+
numpy
tkinter (incluido con Python)
```

### Instalación
```bash
pip install numpy
# tkinter viene incluido
```

### Ejecutar la aplicación
```bash
python main.py
```

### Ejecutar pruebas
```bash
python tests.py
# Salesforce debe mostrar: OK (11 tests)
```

---

## 12. ESTRUCTURA DE CARPETAS FINAL

```
DS - Sistema De Encriptacion/
├── 📄 main.py
├── 📄 interfaz.py
├── 📄 encriptador.py
├── 📄 core.py
├── 📄 tests.py
├── 📄 README.md
├── 📄 GUIA_PRESENTACION.md
├── 📁 __pycache__/
└── 📁 logs/
```

---

## CONCLUSIÓN

Este es un proyecto educativo completo que demuestra:

✓ **Matemática**: Álgebra lineal, matrices invertibles
✓ **Programación**: Python, OOP, servicios
✓ **Diseño**: Arquitectura profesional, SOLID
✓ **Testing**: Pruebas unitarias completas
✓ **UI**: Interfaz gráfica mejorada
✓ **Documentación**: Docstrings y comentarios exhaustivos

**¡Listo para presentar a tus compañeros!** 🎓
