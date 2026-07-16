import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_ENTRY_QR_PNG_OPTIONS,
  buildAccessEntryQrPayload,
  buildAccessEntryQrPayloadForBaseUrl,
  generateAccessEntryQrPng,
  generateAccessEntryQrPngForBaseUrl,
  getAccessQrBaseUrl,
} from "./accessQr";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("Access entry QR contracts", () => {
  it("builds the exact encoded check-in route with or without a trailing slash", () => {
    const token = "  token /?=á  ";
    const expected =
      "https://tickets.example.test/#/access/checkin/token%20%2F%3F%3D%C3%A1";

    assert.equal(
      buildAccessEntryQrPayloadForBaseUrl(token, "https://tickets.example.test"),
      expected,
    );
    assert.equal(
      buildAccessEntryQrPayloadForBaseUrl(token, " https://tickets.example.test/// "),
      expected,
    );
  });

  it("rejects empty tokens and empty base URLs without exposing the token", async () => {
    const sensitiveToken = "synthetic-secret-token";
    assert.throws(
      () => buildAccessEntryQrPayloadForBaseUrl("   ", "https://tickets.example.test"),
      (error) =>
        error instanceof Error &&
        error.message === "Invalid check-in token" &&
        !error.message.includes(sensitiveToken),
    );
    assert.throws(
      () => buildAccessEntryQrPayloadForBaseUrl(sensitiveToken, " /// "),
      (error) =>
        error instanceof Error &&
        error.message === "Invalid QR base URL" &&
        !error.message.includes(sensitiveToken),
    );
    await assert.rejects(
      generateAccessEntryQrPngForBaseUrl("", "https://tickets.example.test"),
      (error) =>
        error instanceof Error &&
        error.message === "Invalid check-in token" &&
        !error.message.includes(sensitiveToken),
    );
  });

  it("generates a non-empty 512px PNG with the fixed QR options", async () => {
    assert.deepEqual(ACCESS_ENTRY_QR_PNG_OPTIONS, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
    });

    const png = await generateAccessEntryQrPngForBaseUrl(
      "synthetic-checkin-token",
      "https://tickets.example.test",
    );

    assert.ok(png.length > PNG_SIGNATURE.length);
    assert.deepEqual(png.subarray(0, PNG_SIGNATURE.length), PNG_SIGNATURE);
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
  });

  it("keeps the legacy environment wrappers equivalent to the explicit functions", async () => {
    const previousBaseUrl = process.env.B2C_BASE_URL;
    process.env.B2C_BASE_URL = " https://legacy.example.test/// ";

    try {
      assert.equal(getAccessQrBaseUrl(), "https://legacy.example.test");
      assert.equal(
        buildAccessEntryQrPayload("legacy-token"),
        buildAccessEntryQrPayloadForBaseUrl(
          "legacy-token",
          "https://legacy.example.test",
        ),
      );

      const [legacyPng, explicitPng] = await Promise.all([
        generateAccessEntryQrPng("legacy-token"),
        generateAccessEntryQrPngForBaseUrl(
          "legacy-token",
          "https://legacy.example.test",
        ),
      ]);
      assert.deepEqual(legacyPng, explicitPng);

      delete process.env.B2C_BASE_URL;
      assert.equal(getAccessQrBaseUrl(), "https://tairet.com.py");
      assert.equal(
        buildAccessEntryQrPayload("legacy-token"),
        buildAccessEntryQrPayloadForBaseUrl(
          "legacy-token",
          "https://tairet.com.py",
        ),
      );

      process.env.B2C_BASE_URL = " /// ";
      assert.equal(getAccessQrBaseUrl(), "");
      assert.equal(
        buildAccessEntryQrPayload("legacy-token"),
        "/#/access/checkin/legacy-token",
      );
      const slashOnlyLegacyPng = await generateAccessEntryQrPng("legacy-token");
      assert.ok(slashOnlyLegacyPng.length > PNG_SIGNATURE.length);
      assert.deepEqual(
        slashOnlyLegacyPng.subarray(0, PNG_SIGNATURE.length),
        PNG_SIGNATURE,
      );
    } finally {
      if (previousBaseUrl === undefined) {
        delete process.env.B2C_BASE_URL;
      } else {
        process.env.B2C_BASE_URL = previousBaseUrl;
      }
    }
  });
});
