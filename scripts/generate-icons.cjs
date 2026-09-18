// Rasterize the existing vector identity for platform home-screen icons.
const sharp = require("sharp");
const fs = require("node:fs/promises");
(async () => {
  await fs.mkdir("public/icons", { recursive: true });
  for (const size of [192, 512, 180])
    await sharp("public/icon.svg")
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}.png`);
  const padded = await sharp("public/icon.svg")
    .resize(384, 384)
    .extend({ top: 64, bottom: 64, left: 64, right: 64, background: "#8b6e77" })
    .png()
    .toBuffer();
  await sharp(padded).png().toFile("public/icons/maskable-512.png");
  console.log("Application icons generated.");
})().catch(() => {
  console.error("Icon generation failed.");
  process.exitCode = 1;
});
