export interface PromoCropSize {
  width: number;
  height: number;
}

export interface PromoImageSize {
  width: number;
  height: number;
}

export interface PromoCropOffset {
  x: number;
  y: number;
}

export interface CreatePromoCroppedFileInput {
  imageSrc: string;
  fileName: string;
  fileType: string;
  cropSize: PromoCropSize;
  imageSize: PromoImageSize;
  offset: PromoCropOffset;
  zoom: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCoverScale(imageSize: PromoImageSize, cropSize: PromoCropSize) {
  return Math.max(cropSize.width / imageSize.width, cropSize.height / imageSize.height);
}

export function clampPromoCropOffset({
  cropSize,
  imageSize,
  offset,
  zoom,
}: {
  cropSize: PromoCropSize;
  imageSize: PromoImageSize;
  offset: PromoCropOffset;
  zoom: number;
}): PromoCropOffset {
  const coverScale = getCoverScale(imageSize, cropSize);
  const renderedWidth = imageSize.width * coverScale * zoom;
  const renderedHeight = imageSize.height * coverScale * zoom;

  const maxOffsetX = Math.max(0, (renderedWidth - cropSize.width) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - cropSize.height) / 2);

  return {
    x: clamp(offset.x, -maxOffsetX, maxOffsetX),
    y: clamp(offset.y, -maxOffsetY, maxOffsetY),
  };
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("No se pudo procesar la imagen seleccionada."));
    image.src = src;
  });
}

export async function createPromoCroppedFile({
  imageSrc,
  fileName,
  fileType,
  cropSize,
  imageSize,
  offset,
  zoom,
}: CreatePromoCroppedFileInput): Promise<File> {
  const image = await loadImageElement(imageSrc);
  const safeZoom = Math.max(1, zoom);
  const safeOffset = clampPromoCropOffset({
    cropSize,
    imageSize,
    offset,
    zoom: safeZoom,
  });

  const coverScale = getCoverScale(imageSize, cropSize);
  const scaledImageWidth = imageSize.width * coverScale * safeZoom;
  const scaledImageHeight = imageSize.height * coverScale * safeZoom;
  const imageLeft = (cropSize.width - scaledImageWidth) / 2 + safeOffset.x;
  const imageTop = (cropSize.height - scaledImageHeight) / 2 + safeOffset.y;

  const sourceX = clamp(
    (0 - imageLeft) / (coverScale * safeZoom),
    0,
    imageSize.width
  );
  const sourceY = clamp(
    (0 - imageTop) / (coverScale * safeZoom),
    0,
    imageSize.height
  );
  const sourceWidth = clamp(
    cropSize.width / (coverScale * safeZoom),
    1,
    imageSize.width - sourceX
  );
  const sourceHeight = clamp(
    cropSize.height / (coverScale * safeZoom),
    1,
    imageSize.height - sourceY
  );

  const outputWidth = Math.max(1, Math.round(sourceWidth));
  const outputHeight = Math.max(1, Math.round(sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo preparar el recorte de la imagen.");
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      resolve,
      fileType,
      fileType === "image/png" ? undefined : 0.92
    );
  });

  if (!blob) {
    throw new Error("No se pudo generar la imagen recortada.");
  }

  return new File([blob], fileName, {
    type: fileType,
    lastModified: Date.now(),
  });
}
