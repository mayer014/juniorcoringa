import sharp from "sharp";

const assets = [
  {
    input: "public/images/logo-junior-coringa.png",
    output: "public/images/logo-junior-coringa.webp",
    width: 1200,
  },
  {
    input: "public/images/junior-coringa-corpo-inteiro.png",
    output: "public/images/junior-coringa-corpo-inteiro.webp",
    width: 1200,
  },
  {
    input: "public/images/junior-coringa-retrato.png",
    output: "public/images/junior-coringa-retrato.webp",
    width: 900,
  },
];

await Promise.all(
  [
    ...assets.map(({ input, output, width }) =>
      sharp(input)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 88, alphaQuality: 95 })
        .toFile(output),
    ),
    sharp("public/images/logo-junior-coringa.png")
      .resize({ width: 256, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile("public/favicon.png"),
  ],
);

console.log("Imagens otimizadas com sucesso.");
