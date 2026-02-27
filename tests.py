"""
Pruebas unitarias del sistema de encriptación.
"""

import unittest
import numpy as np
from encriptador import (
    Encriptador,
    MatrizInvalidaError,
    ClaveInvalidaError,
    PermutacionInvalidaError
)
from core import (
    ServicioAutenticacion,
    ServicioEncriptacion,
    AutenticacionError,
    EncriptacionError
)


class TestEncriptador(unittest.TestCase):
    """Pruebas de encriptación."""
    
    def setUp(self):
        self.enc = Encriptador()
    
    def test_encrypt_decrypt(self):
        """Encriptar y desencriptar."""
        texto = "Hola Mundo"
        cifrado = self.enc.encriptar(texto)
        descifrado = self.enc.desencriptar(cifrado)
        self.assertEqual(texto, descifrado)
    
    def test_invalid_key(self):
        """Rechazar matriz no invertible."""
        with self.assertRaises(ClaveInvalidaError):
            Encriptador([[1, 2], [2, 4]])
    
    def test_unicode_characters(self):
        """Soportar caracteres especiales."""
        texto = "¡Hola! @#$"
        cifrado = self.enc.encriptar(texto)
        descifrado = self.enc.desencriptar(cifrado)
        self.assertEqual(texto, descifrado)


class TestAutenticacion(unittest.TestCase):
    """Pruebas de autenticación."""
    
    def setUp(self):
        self.auth = ServicioAutenticacion("test", "test123")
    
    def test_valid_login(self):
        """Login válido."""
        result = self.auth.autenticar("test", "test123")
        self.assertTrue(result)
    
    def test_invalid_login(self):
        """Login inválido."""
        with self.assertRaises(AutenticacionError):
            self.auth.autenticar("test", "wrong")
    
    def test_max_attempts(self):
        """Límite de intentos."""
        for _ in range(3):
            try:
                self.auth.autenticar("test", "wrong")
            except AutenticacionError:
                pass
        
        with self.assertRaises(AutenticacionError):
            self.auth.autenticar("test", "test123")
    
    def test_verify_password(self):
        """Verificar contraseña."""
        self.assertTrue(self.auth.verificar_password("test123"))
        self.assertFalse(self.auth.verificar_password("wrong"))


class TestServicioEncriptacion(unittest.TestCase):
    """Pruebas del servicio."""
    
    def setUp(self):
        self.service = ServicioEncriptacion()
    
    def test_has_no_active_encryption(self):
        """Sin encriptación activa al inicio."""
        self.assertFalse(self.service.tiene_encriptacion_activa())
    
    def test_encrypt_text(self):
        """Encriptar por servicio."""
        from encriptador import Encriptador
        resultado = self.service.encriptar("Test", Encriptador)
        self.assertIn("cifrado", resultado)
        self.assertTrue(self.service.tiene_encriptacion_activa())
    
    def test_decrypt_after_encrypt(self):
        """Desencriptar después de encriptar."""
        from encriptador import Encriptador
        texto = "Prueba"
        self.service.encriptar(texto, Encriptador)
        descifrado = self.service.desencriptar()
        self.assertEqual(texto, descifrado)
    
    def test_history(self):
        """Historial de encriptaciones."""
        from encriptador import Encriptador
        self.service.encriptar("Texto1", Encriptador)
        self.service.encriptar("Texto2", Encriptador)
        
        historial = self.service.obtener_historial()
        self.assertEqual(len(historial), 2)
        self.assertEqual(historial[0]['texto'], "Texto1")


if __name__ == "__main__":
    unittest.main(verbosity=2)
