/**
 * Helpers para manejo de galería de locales.
 * Separa correctamente:
 * - cover: foto de perfil para cards/listado
 * - hero: imagen principal del perfil (solo bar)
 * - categorías: food, menu, drinks, interior
 * - carousel: galería de club
 */

import type { LocalGalleryItem, GalleryKind } from "./locals";

/**
 * Ordena items de galería por order ascendente
 */
export const sortByOrder = (items: LocalGalleryItem[]): LocalGalleryItem[] =>
  [...items].sort((a, b) => a.order - b.order);

/**
 * Obtiene la imagen de cover (foto de perfil para cards) de la galería
 */
export const getCover = (gallery: LocalGalleryItem[]): LocalGalleryItem | null =>
  gallery.find((g) => g.kind === "cover") || null;

/**
 * Obtiene la imagen hero (imagen principal del perfil, solo bar) de la galería
 */
export const getHero = (gallery: LocalGalleryItem[]): LocalGalleryItem | null =>
  gallery.find((g) => g.kind === "hero") || null;

/**
 * Obtiene todas las imágenes de galería de bar EXCLUYENDO cover.
 * Incluye: hero, food, menu, drinks, interior
 */
export const getBarGalleryImages = (gallery: LocalGalleryItem[]): LocalGalleryItem[] =>
  sortByOrder(gallery.filter((g) => g.kind !== "cover"));

/**
 * Obtiene imágenes de una categoría específica (bar).
 * @param gallery Array de items de galería
 * @param kind Tipo de categoría (food, menu, drinks, interior, hero)
 */
export const getBarCategory = (
  gallery: LocalGalleryItem[],
  kind: GalleryKind
): LocalGalleryItem[] => sortByOrder(gallery.filter((g) => g.kind === kind));

/**
 * Obtiene imágenes del carrusel de club (solo kind="carousel").
 * Excluye cover automáticamente.
 */
export const getClubCarousel = (gallery: LocalGalleryItem[]): LocalGalleryItem[] =>
  sortByOrder(gallery.filter((g) => g.kind === "carousel"));
