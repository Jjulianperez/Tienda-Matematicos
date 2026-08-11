# TAREAS PARA MAÑANA

Lista de pendientes para dejar el trabajo de la tienda **MateMáticos** terminado. Ordenadas por prioridad.


## 2. Admin y promociones (depende del punto 1)

- Probar el alta/edición de promociones y combos desde `/admin/promociones` con la base de datos real.
- Crear una promo de ejemplo por categoría (con `min_quantity` y descuento) y un combo, y verificar:
  - Que aparezca la sección correspondiente en el home y el chip "En oferta" en el catálogo.
  - Que el carrito aplique el precio efectivo (`lib/pricing.js`) al superar la cantidad mínima.
  - Que el combo se facture como una línea de precio fijo.
- Crear el/los admin con `node scripts/create-admin.js admin@matematicos.com tu-contraseña` si hace falta.

## 3. Prueba manual completa en navegador

- **Catálogo mobile**: buscador (que la lupa y el placeholder ya no se encimen), select de orden con su chevron, botón Filtros alineado.
- **Menú hamburguesa**: abrir/cerrar tras hacer scroll (debe quedar anclado al navbar).
- **Scroll suave Lenis**: que los modales (FormModal, CartSidebar, panel admin) scrolleen interno sin trabarse.
- **Carrito**: agregar, editar cantidades, combo, checkout por WhatsApp con número correcto.
- **Home**: animaciones de entrada, decoración geométrica (π, fórmulas), cards de producto.
- **Flujo de pedido**: confirmar que el pedido queda registrado en `/admin/ordenes` y llega el mail (Resend).
- Probar responsive en 3 tamaños (mobile, tablet, desktop).

## 4. Animaciones con Blender (PENDIENTE)

- Definir qué se anima: assets 3D de producto (mate, bombilla, termo) o una escena/hero.
- Modelar y animar en Blender (ciclo de rotación, fondo acorde a la paleta carbon + olive `#6E8B3D`).
- Exportar a formato web. Opciones:
  - **Video** (WebM/MP4 con fondo transparente o verde): simple de integrar con `<video>` autoplay muted loop.
  - **GLB/USDZ** (Model Viewer / three.js): interacción 3D real, pero requiere librería extra y mayor peso.
- Integrar en el home (hero o sección destacada) sin romper el responsive ni la identidad visual.
- Optimizar peso (comprimir, duración corta ~5s, 720p máximo) y verificar performance en mobile.

## 5. Limpieza técnica

- Migrar los `<img>` de los paneles admin a `next/image` para eliminar los warnings de `npm run lint` (0 errores hoy, solo warnings).
- Revisar `.env.example` y que `.env.local` no esté versionado (`.gitignore`).
- Borrar código muerto si quedó (componentes demo ya eliminados).

## 6. Deploy final

- Push final a `origin/master` (Vercel despliega solo).
- Verificar en producción: catálogo, detalle, carrito, checkout WhatsApp, admin, promos y animaciones.
- Test de carga/velocidad básico (Lighthouse) y revisar que el scroll Lenis no afecte la navegación.
