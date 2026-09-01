# Prueba del flujo rama → pull request

Creado para verificar que `main` está protegida y que los agentes publican
por rama y PR en vez de empujar a producción.

- Push directo a `main`: rechazado con `GH013 · Changes must be made through a pull request`
- Push a rama: permitido
- Publica Netlify solo cuando Javi fusiona el PR

Este archivo se puede borrar cuando quieras.
