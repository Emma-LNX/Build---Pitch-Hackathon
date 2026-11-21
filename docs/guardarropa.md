# Guardarropa: indumentaria de Guatemala

El estudiante desbloquea conjuntos de indumentaria de comunidades de Guatemala al acumular XP. Equipar no gasta XP, los desbloqueos son permanentes y todos los conjuntos valen lo mismo: no hay rarezas, monedas ni ventajas.

## Catálogo por género

El género del perfil filtra el catálogo: “Niña” ve los conjuntos de presentación femenina y “Niño” los de presentación masculina. Si se corrige el género:

- el catálogo cambia;
- se equipa el último conjunto elegido para esa presentación o, si no hay, el inicial;
- la XP y los desbloqueos se conservan (los desbloqueos se calculan para ambas presentaciones).

| XP | Femenina | Masculina |
| --- | --- | --- |
| 0 (inicial) | Chichicastenango, Quiché | Todos Santos Cuchumatán, Huehuetenango |
| 100 | San Juan Sacatepéquez, Guatemala | Santiago Atitlán, Sololá |
| 250 | Santa María Nebaj, Quiché | Sololá, Sololá (**sin ilustración**) |
| 450 | Santiago Atitlán, Sololá | Nahualá, Sololá (**sin ilustración**) |

Los umbrales son provisionales (`UNLOCK_THRESHOLDS` en `frontend/src/features/wardrobe/outfits.ts`).

## Estado cultural: nada está validado todavía

| Estado | Significado | En la app |
| --- | --- | --- |
| `en-revision` | Ficha con fuentes publicadas; ilustración interpretada a partir de ellas | “Ilustración en revisión: … aún no validada por el museo ni la comunidad” |
| `pendiente-ilustracion` | Ficha documentada, pero faltan datos (colores, diseño) para dibujarlo con fidelidad | Silueta con “?”, “Próximamente”; no se puede equipar ni se celebra |
| `verificado` | Revisado con la fuente y, idealmente, con la comunidad | Ninguno todavía |

Cada ficha cita sus fuentes en la app (sección “Fuentes”) y anota en `pendingDetails` lo que la ilustración no puede respaldar. Por ejemplo, en San Juan Sacatepéquez y Santiago Atitlán (femenino) **el corte es liso porque no está documentado**.

### Fuentes consultadas

- Prensa Libre, serie “Tradición textil maya”: [Chichicastenango](https://www.prensalibre.com/vida/escenario/tradicion-textil-maya-chichicastenango-quiche/), [Nebaj](https://www.prensalibre.com/vida/escenario/tradicion-textil-maya-nebaj-quiche/), [Santiago Atitlán](https://www.prensalibre.com/vida/escenario/tradicion-textil-maya-santiago-atitlan-solola/); “[Es vestir, no moda](https://www.prensalibre.com/revista-d/es-vestir-no-moda/)” (rodillera de Sololá).
- Museo Ixchel del Traje Indígena: [perrajes](https://museoixchel.org/coleccion-textil-perrajes/) (Nebaj MI-00968), [camisas](https://museoixchel.org/en/textile-shirts/) (Todos Santos MI-06867), [pieza del mes](https://ixchelm.squarespace.com/pieza-del-mes) (pantalón de Santiago Atitlán).
- Textile Research Centre, Leiden: “[1210 huipiles from Guatemala](https://www.trc-leiden.nl/trc/index.php/en/blog/1210-huipiles-from-guatemala)”.
- Deguate: [Santiago Atitlán](https://www.deguate.com/arte-cultura/vestimenta-guatemala/traje-tipico-de-santiago-atitlan.shtml), [Todos Santos Cuchumatán](https://deguate.com/artman/publish/Huehuetenango_228/todos_santos_cuchumatan.shtml), [Nahualá](https://www.deguate.com/arte-cultura/vestimenta-guatemala/traje-tipico-de-nahuala.shtml); [Huipils.com: Nebaj](https://huipils.com/nebaj/).

El catálogo en línea del Museo Ixchel documenta **piezas sueltas**, no conjuntos completos. Varias fichas se apoyan en fuentes periodísticas o divulgativas. Por eso todas siguen en revisión.

## Dónde está cada cosa

| Qué | Archivo |
| --- | --- |
| Fichas, fuentes, umbrales y reglas | `frontend/src/features/wardrobe/outfits.ts` |
| Ilustraciones (SVG locales, una por conjunto) | `frontend/src/features/wardrobe/art.tsx` |
| Cuerpo base del avatar | `frontend/src/components/Avatar.tsx` |
| Pantalla | `frontend/src/features/wardrobe/WardrobePage.tsx` |

Las ilustraciones son código SVG dentro del paquete de la app, así que se guardan en caché y funcionan sin conexión. Todas usan el mismo cuerpo, pose y proporciones. Cada conjunto dibuja sus propias prendas (cuellos, lienzos, tocados, sobrepantalón, bordados); ninguno es otro conjunto con distintos colores.

## Para validar o agregar un conjunto

1. Reunir una referencia del conjunto completo de esa comunidad: museo, publicación etnográfica o la comunidad misma. Anotar la cita.
2. Redactar la ficha solo con lo que dice la fuente. No atribuir significados a motivos ni combinar prendas que la fuente no documente juntas.
3. Ilustrar sobre el cuerpo base en `art.tsx`. Lo que no esté documentado va en `pendingDetails`.
4. Revisar con la fuente o la comunidad. Solo entonces cambiar `review` a `verificado`.
5. Para reemplazar una ilustración, conservar el `id`, así los estudiantes no pierden lo desbloqueado.

**Prioridad:** conseguir referencias de color y diseño para Sololá y Nahualá (masculinos). Sin ellas, los niños tienen dos conjuntos menos para vestir.
