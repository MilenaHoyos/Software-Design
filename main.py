"""
╔═══════════════════════════════════════════════════════════════════════╗
║                      PUNTO DE ENTRADA DEL SISTEMA                    ║
║                   ENCRIPTADOR MATRICIAL NxN                          ║
╚═══════════════════════════════════════════════════════════════════════╝

Este módulo es el punto de entrada principal de la aplicación.
Simplemente instancia la interfaz gráfica y la inicia.

EJECUCIÓN:
==========
    python main.py

FLUJO:
======
1. Importar InterfazEncriptador desde interfaz.py
2. Crear instancia de la aplicación
3. Iniciar loop principal de tkinter (mainloop)
4. La interfaz maneja toda la lógica de usuario

ESTRUCTURA DEL PROYECTO:
========================
├── main.py ..................... Este archivo (punto de entrada)
├── encriptador.py .............. Lógica de encriptación (matrices)
├── interfaz.py ................. Interfaz gráfica (tkinter)
├── core.py ..................... Servicios y configuración central
├── tests.py .................... Suite de pruebas unitarias
└── README.md ................... Documentación

DEPENDENCIAS:
=============
- tkinter: Interfaz gráfica (incluido con Python)
- numpy: Operaciones matriciales
- encriptador: Lógica de encriptación matemática
- interfaz: Interfaz de usuario
"""

from interfaz import InterfazEncriptador


def main() -> None:
    """
    FUNCIÓN PRINCIPAL - PUNTO DE ENTRADA
    ====================================
    
    Crea instancia de la aplicación y la inicia.
    
    Esta función:
    1. Instancia InterfazEncriptador
    2. Inicia el loop de eventos de tkinter
    
    Returns:
        None (Se queda ejecutando hasta que el usuario cierre la ventana)
    
    Note:
        La interfaz gráfica maneja toda la lógica de usuario.
        No hay procesamiento en este nivel.
    """
    app = InterfazEncriptador()
    # El mainloop() está incluido en InterfazEncriptador.__init__()


if __name__ == "__main__":
    """Ejecutar aplicación sólo si este archivo es el script principal."""
    main()
