import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_ENTRIES_EMAIL_SUBJECT,
  ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
  AccessEmailMessageError,
  buildAccessEmailCanonicalRequestPayload,
  buildAccessEntriesEmailHtml,
  buildAccessEntriesEmailMessage,
  calculateAccessEmailRequestPayloadHash,
  canonicalizeAccessEntriesEmailEntries,
  renderAccessEntriesEmailContent,
  type AccessEmailMessage,
  type AccessEmailAttachment,
  type AccessEntriesEmailMessageInput,
} from "./accessEmailMessage";
import { generateAccessEntryQrPngForBaseUrl } from "./accessQr";

const ORDER_ITEM_A = "11111111-1111-4111-8111-111111111111";
const ORDER_ITEM_B = "22222222-2222-4222-8222-222222222222";
const ENTRY_A1_FIRST = "30000000-0000-4000-8000-000000000001";
const ENTRY_A1_SECOND = "30000000-0000-4000-8000-000000000002";
const ENTRY_A2 = "30000000-0000-4000-8000-000000000003";
const ENTRY_B1 = "30000000-0000-4000-8000-000000000004";
const EXPECTED_ENTRY_IDS = [
  ENTRY_A1_FIRST,
  ENTRY_A1_SECOND,
  ENTRY_A2,
  ENTRY_B1,
];
const EXPECTED_REQUEST_PAYLOAD_HASH =
  "3273c9c02236e89659445d5db11737fd06fe5905e194ee1825fa896ea884b6f0";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function fixtureInput(): AccessEntriesEmailMessageInput {
  return {
    from: "access@example.test",
    buyerEmail: "  BUYER@Example.Test ",
    buyerName: "Mateo & Ana",
    publicRef: "ACC-<42>",
    sourceName: "Evento <Central>",
    accessDate: "2026-02-07",
    qrBaseUrl: "https://tickets.example.test/",
    entries: [
      {
        id: ENTRY_B1,
        orderItemId: ORDER_ITEM_B,
        unitIndex: 1,
        ticketName: "General",
        attendeeName: "Bruno",
        attendeeLastName: "Final",
        checkinToken: "token/bruno?entry=4",
      },
      {
        id: ENTRY_A2,
        orderItemId: ORDER_ITEM_A,
        unitIndex: 2,
        ticketName: "VIP & Backstage",
        attendeeName: "Carla",
        attendeeLastName: "Segunda",
        checkinToken: "token/carla?entry=3",
      },
      {
        id: ENTRY_A1_SECOND,
        orderItemId: ORDER_ITEM_A,
        unitIndex: 1,
        ticketName: "VIP & Backstage",
        attendeeName: "Beto",
        attendeeLastName: "Segundo",
        checkinToken: "token/beto?entry=2",
      },
      {
        id: ENTRY_A1_FIRST,
        orderItemId: ORDER_ITEM_A,
        unitIndex: 1,
        ticketName: "VIP & Backstage",
        attendeeName: "Ana <Test>",
        attendeeLastName: "Primera",
        checkinToken: "token/ana?entry=1",
      },
    ],
  };
}

function withMessageChanges(
  message: AccessEmailMessage,
  messageChanges: Partial<AccessEmailMessage> = {},
  firstAttachmentChanges: Partial<AccessEmailAttachment> = {},
): AccessEmailMessage {
  return {
    from: message.from,
    to: [...message.to],
    subject: message.subject,
    html: message.html,
    attachments: message.attachments.map((attachment, index) => ({
      ...attachment,
      ...(index === 0 ? firstAttachmentChanges : {}),
    })),
    ...messageChanges,
  };
}

describe("deterministic Access entries email message", () => {
  it("builds the canonical provider payload while preserving the visible legacy email", async () => {
    const input = fixtureInput();
    const inputBeforeBuild = structuredClone(input);
    const built = await buildAccessEntriesEmailMessage(input);

    assert.deepEqual(input, inputBeforeBuild);
    assert.equal(built.templateVersion, "access-entries-v1");
    assert.equal(built.templateVersion, ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION);
    assert.equal(built.message.from, "access@example.test");
    assert.deepEqual(built.message.to, ["buyer@example.test"]);
    assert.equal(built.message.subject, ACCESS_ENTRIES_EMAIL_SUBJECT);
    assert.equal(built.message.subject, "Tus entradas Tairet están listas");
    assert.deepEqual(built.entryIds, EXPECTED_ENTRY_IDS);
    assert.deepEqual(
      built.message.attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        contentId: attachment.contentId,
      })),
      EXPECTED_ENTRY_IDS.map((_, index) => ({
        filename: `entrada-${index + 1}.png`,
        contentType: "image/png",
        contentId: `access-entry-qr-${index + 1}`,
      })),
    );
    for (const attachment of built.message.attachments) {
      const png = Buffer.from(attachment.content, "base64");
      assert.ok(png.length > PNG_SIGNATURE.length);
      assert.deepEqual(png.subarray(0, PNG_SIGNATURE.length), PNG_SIGNATURE);
    }

    const html = built.message.html;
    const serializedMessage = JSON.stringify(built.message);
    for (const text of [
      "Tus entradas están listas",
      "Guardá este email y presentá cada QR en puerta.",
      "Tu pago fue confirmado y tus entradas ya fueron emitidas.",
      "Referencia:",
      "ACC-&lt;42&gt;",
      "Lugar o evento:",
      "Evento &lt;Central&gt;",
      "sábado, 7 de febrero de 2026",
      "VIP &amp; Backstage",
      "General",
      "Mateo &amp; Ana",
      "Ana &lt;Test&gt; Primera",
      "No compartas estos QR; cada código es único para un acceso.",
      "abrí la imagen PNG correspondiente en pantalla completa.",
    ]) {
      assert.ok(html.includes(text), text);
    }
    const attendeePositions = [
      "Ana &lt;Test&gt; Primera",
      "Beto Segundo",
      "Carla Segunda",
      "Bruno Final",
    ].map((attendee) => html.indexOf(attendee));
    assert.ok(attendeePositions.every((position) => position >= 0));
    assert.deepEqual(attendeePositions, [...attendeePositions].sort((a, b) => a - b));

    for (const entry of input.entries) {
      assert.equal(html.includes(entry.checkinToken.trim()), false);
      assert.equal(serializedMessage.includes(entry.checkinToken.trim()), false);
    }
    assert.match(built.requestPayloadHash, /^[0-9a-f]{64}$/);
    assert.equal(built.requestPayloadHash, EXPECTED_REQUEST_PAYLOAD_HASH);
  });

  it("preserves received order in the legacy renderer while durable output is canonical", async () => {
    const input = fixtureInput();
    const inputBeforeRender = structuredClone(input);
    const rendered = await renderAccessEntriesEmailContent(
      {
        buyerName: input.buyerName,
        publicRef: input.publicRef,
        sourceName: input.sourceName,
        accessDate: input.accessDate,
        entries: input.entries,
      },
      (checkinToken) =>
        generateAccessEntryQrPngForBaseUrl(checkinToken, input.qrBaseUrl),
    );
    const durable = await buildAccessEntriesEmailMessage(input);
    const expectedLegacyAttendees = [
      "Bruno Final",
      "Carla Segunda",
      "Beto Segundo",
      "Ana &lt;Test&gt; Primera",
    ];
    const legacyPositions = expectedLegacyAttendees.map((attendee) =>
      rendered.html.indexOf(attendee),
    );
    const durablePositions = expectedLegacyAttendees.map((attendee) =>
      durable.message.html.indexOf(attendee),
    );

    assert.deepEqual(input, inputBeforeRender);
    assert.ok(legacyPositions.every((position) => position >= 0));
    assert.deepEqual(legacyPositions, [...legacyPositions].sort((a, b) => a - b));
    assert.deepEqual(
      durablePositions,
      [...durablePositions].sort((a, b) => a - b).reverse(),
    );
    assert.ok(
      rendered.html.includes(
        "<strong style=\"color:#0f172a;\">Tipos:</strong> General, VIP &amp; Backstage",
      ),
    );
    assert.ok(
      durable.message.html.includes(
        "<strong style=\"color:#0f172a;\">Tipos:</strong> VIP &amp; Backstage, General",
      ),
    );
    assert.deepEqual(
      rendered.attachments.map(({ filename, contentId }) => ({
        filename,
        contentId,
      })),
      input.entries.map((_, index) => ({
        filename: `entrada-${index + 1}.png`,
        contentId: `access-entry-qr-${index + 1}`,
      })),
    );

    const expectedQrContents = await Promise.all(
      input.entries.map(async (entry) =>
        (
          await generateAccessEntryQrPngForBaseUrl(
            entry.checkinToken,
            input.qrBaseUrl,
          )
        ).toString("base64"),
      ),
    );
    assert.deepEqual(
      rendered.attachments.map((attachment) => attachment.content),
      expectedQrContents,
    );
    assert.notDeepEqual(
      durable.message.attachments.map((attachment) => attachment.content),
      expectedQrContents,
    );
  });

  it("matches PostgreSQL UUID ordering and ignores the received entry order", async () => {
    const input = fixtureInput();
    const reversedInput = {
      ...fixtureInput(),
      entries: [...fixtureInput().entries].reverse(),
    };

    assert.deepEqual(
      canonicalizeAccessEntriesEmailEntries(input.entries).map((entry) => entry.id),
      EXPECTED_ENTRY_IDS,
    );

    const [built, reversed] = await Promise.all([
      buildAccessEntriesEmailMessage(input),
      buildAccessEntriesEmailMessage(reversedInput),
    ]);
    assert.deepEqual(reversed, built);
  });

  it("orders canonical UUID bytes across groups, hex letters and leading-zero boundaries", () => {
    const baseEntry = fixtureInput().entries[0];
    const entries = [
      {
        ...baseEntry,
        id: "00000000-0000-4000-8000-000000000007",
        orderItemId: "0000000f-0000-4000-8000-000000000000",
        unitIndex: 1,
      },
      {
        ...baseEntry,
        id: "00000000-0000-4000-8000-000000000001",
        orderItemId: "00000000-0000-4000-8000-00000000000f",
        unitIndex: 2,
      },
      {
        ...baseEntry,
        id: "00000000-0000-4000-8000-000000000004",
        orderItemId: "00000000-0000-4000-8000-000000000010",
        unitIndex: 1,
      },
      {
        ...baseEntry,
        id: "00000000-0000-4000-8000-000000000010",
        orderItemId: "00000000-0000-4000-8000-00000000000f",
        unitIndex: 1,
      },
      {
        ...baseEntry,
        id: "00000000-0000-4000-8000-000000000006",
        orderItemId: "0000000a-0000-4000-8000-000000000000",
        unitIndex: 1,
      },
      {
        ...baseEntry,
        id: "00000000-0000-4000-8000-00000000000A",
        orderItemId: "00000000-0000-4000-8000-00000000000F",
        unitIndex: 1,
      },
      {
        ...baseEntry,
        id: "00000000-0000-4000-8000-000000000005",
        orderItemId: "00000000-000A-4000-8000-000000000000",
        unitIndex: 1,
      },
    ];
    const before = structuredClone(entries);
    const canonical = canonicalizeAccessEntriesEmailEntries(entries);

    assert.deepEqual(entries, before);
    assert.notStrictEqual(canonical, entries);
    canonical.forEach((entry) => {
      assert.ok(entries.every((original) => original !== entry));
    });
    assert.deepEqual(
      canonical.map(({ orderItemId, unitIndex, id }) => [
        orderItemId,
        unitIndex,
        id,
      ]),
      [
        [
          "00000000-0000-4000-8000-00000000000f",
          1,
          "00000000-0000-4000-8000-00000000000a",
        ],
        [
          "00000000-0000-4000-8000-00000000000f",
          1,
          "00000000-0000-4000-8000-000000000010",
        ],
        [
          "00000000-0000-4000-8000-00000000000f",
          2,
          "00000000-0000-4000-8000-000000000001",
        ],
        [
          "00000000-0000-4000-8000-000000000010",
          1,
          "00000000-0000-4000-8000-000000000004",
        ],
        [
          "00000000-000a-4000-8000-000000000000",
          1,
          "00000000-0000-4000-8000-000000000005",
        ],
        [
          "0000000a-0000-4000-8000-000000000000",
          1,
          "00000000-0000-4000-8000-000000000006",
        ],
        [
          "0000000f-0000-4000-8000-000000000000",
          1,
          "00000000-0000-4000-8000-000000000007",
        ],
      ],
    );
  });

  it("hashes every provider field and the template version but no idempotency key", async () => {
    const built = await buildAccessEntriesEmailMessage(fixtureInput());
    const canonicalPayload = buildAccessEmailCanonicalRequestPayload({
      templateVersion: built.templateVersion,
      message: built.message,
    });
    const serialized = JSON.stringify(canonicalPayload);

    assert.deepEqual(
      canonicalPayload.map((field) => (field as readonly unknown[])[0]),
      ["templateVersion", "from", "to", "subject", "html", "attachments"],
    );
    assert.equal(serialized.includes("idempotency"), false);
    assert.equal(serialized.includes("orderId"), false);
    assert.equal(serialized.includes("lease"), false);
    assert.equal(serialized.includes("delivery_attempt"), false);

    const changedMessages = [
      withMessageChanges(built.message, {
        from: "other-sender@example.test",
      }),
      withMessageChanges(built.message, {
        subject: "changed subject",
      }),
      withMessageChanges(built.message, {
        html: `${built.message.html}<p>changed</p>`,
      }),
      withMessageChanges(built.message, {
        to: ["other@example.test"],
      }),
      withMessageChanges(built.message, {}, {
        content: `${built.message.attachments[0].content}changed`,
      }),
      withMessageChanges(built.message, {}, {
        contentId: "changed-cid",
      }),
      withMessageChanges(built.message, {}, {
        filename: "changed.png",
      }),
      withMessageChanges(built.message, {}, {
        contentType: "application/octet-stream",
      }),
    ];
    for (const message of changedMessages) {
      assert.notEqual(
        calculateAccessEmailRequestPayloadHash({
          templateVersion: built.templateVersion,
          message,
        }),
        built.requestPayloadHash,
      );
    }
    assert.notEqual(
      calculateAccessEmailRequestPayloadHash({
        templateVersion: "access-entries-v2",
        message: built.message,
      }),
      built.requestPayloadHash,
    );
  });

  it("returns defensive frozen structures and hashing does not mutate the message", async () => {
    const input = fixtureInput();
    const canonical = canonicalizeAccessEntriesEmailEntries(input.entries);
    const [first, second] = await Promise.all([
      buildAccessEntriesEmailMessage(input),
      buildAccessEntriesEmailMessage(input),
    ]);
    const messageBeforeHash = structuredClone(first.message);

    assert.ok(Object.isFrozen(canonical));
    assert.ok(canonical.every((entry) => Object.isFrozen(entry)));
    assert.notStrictEqual(canonical, input.entries);
    assert.ok(
      canonical.every((entry) =>
        input.entries.every((originalEntry) => originalEntry !== entry),
      ),
    );
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.entryIds));
    assert.ok(Object.isFrozen(first.message));
    assert.ok(Object.isFrozen(first.message.to));
    assert.ok(Object.isFrozen(first.message.attachments));
    assert.ok(
      first.message.attachments.every((attachment) =>
        Object.isFrozen(attachment),
      ),
    );
    assert.notStrictEqual(first.entryIds, second.entryIds);
    assert.notStrictEqual(first.message, second.message);
    assert.notStrictEqual(first.message.to, second.message.to);
    assert.notStrictEqual(
      first.message.attachments,
      second.message.attachments,
    );
    first.message.attachments.forEach((attachment, index) => {
      assert.notStrictEqual(attachment, second.message.attachments[index]);
    });

    assert.equal(
      Reflect.set(first.message, "subject", "changed subject"),
      false,
    );
    assert.equal(
      Reflect.set(first.message.to, "0", "changed@example.test"),
      false,
    );
    assert.equal(
      Reflect.set(first.message.attachments[0], "filename", "changed.png"),
      false,
    );
    assert.equal(Reflect.set(first.entryIds, "0", ENTRY_B1), false);

    const recalculatedHash = calculateAccessEmailRequestPayloadHash({
      templateVersion: first.templateVersion,
      message: first.message,
    });
    assert.deepEqual(first.message, messageBeforeHash);
    assert.equal(recalculatedHash, first.requestPayloadHash);
    assert.equal(first.requestPayloadHash, EXPECTED_REQUEST_PAYLOAD_HASH);
  });

  it("formats dates explicitly across leap/month boundaries and rejects invalid durable dates", async () => {
    const htmlForDate = (accessDate: string): string =>
      buildAccessEntriesEmailHtml({
        buyerName: "Cliente",
        publicRef: "ACC-DATE",
        sourceName: "Tairet",
        accessDate,
        entries: [
          {
            ticketName: "General",
            attendeeName: "Ana",
            attendeeLastName: "Prueba",
            contentId: "access-entry-qr-1",
          },
        ],
      });

    assert.ok(
      htmlForDate("2024-02-29").includes(
        "jueves, 29 de febrero de 2024",
      ),
    );
    assert.ok(
      htmlForDate("2024-03-01").includes("viernes, 1 de marzo de 2024"),
    );
    assert.ok(
      htmlForDate("2026-01-31").includes("sábado, 31 de enero de 2026"),
    );
    assert.ok(
      htmlForDate("2026-02-01").includes("domingo, 1 de febrero de 2026"),
    );

    const originalTimeZone = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati";
      const easternHtml = htmlForDate("2026-02-07");
      process.env.TZ = "America/Los_Angeles";
      const westernHtml = htmlForDate("2026-02-07");
      assert.equal(westernHtml, easternHtml);
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    }

    assert.ok(htmlForDate("2024-02-30").includes("2024-02-30"));
    await assert.rejects(
      buildAccessEntriesEmailMessage({
        ...fixtureInput(),
        accessDate: "2024-02-30",
      }),
      (error) =>
        error instanceof AccessEmailMessageError &&
        error.code === "invalid_access_date",
    );
  });

  it("produces the same message and hash for repeated logical input", async () => {
    const first = await buildAccessEntriesEmailMessage(fixtureInput());
    const second = await buildAccessEntriesEmailMessage(fixtureInput());

    assert.deepEqual(second, first);
  });

  it("rejects duplicate or invalid entry identities, units, tokens and addresses", async () => {
    const duplicateFixture = fixtureInput();
    const duplicate = {
      ...duplicateFixture,
      entries: [
        duplicateFixture.entries[0],
        {
          ...duplicateFixture.entries[1],
          id: duplicateFixture.entries[0].id.toUpperCase(),
        },
      ],
    };
    const invalidUuidFixture = fixtureInput();
    const invalidUuid = {
      ...invalidUuidFixture,
      entries: [
        {
          ...invalidUuidFixture.entries[0],
          orderItemId: "not-a-uuid",
        },
      ],
    };
    const invalidUnitFixture = fixtureInput();
    const invalidUnit = {
      ...invalidUnitFixture,
      entries: [{ ...invalidUnitFixture.entries[0], unitIndex: 0 }],
    };
    const invalidTokenFixture = fixtureInput();
    const invalidToken = {
      ...invalidTokenFixture,
      entries: [{ ...invalidTokenFixture.entries[0], checkinToken: "   " }],
    };

    for (const input of [invalidUuid, invalidUnit, invalidToken]) {
      await assert.rejects(
        buildAccessEntriesEmailMessage(input),
        (error) =>
          error instanceof AccessEmailMessageError &&
          error.code === "invalid_entry",
      );
    }
    await assert.rejects(
      buildAccessEntriesEmailMessage(duplicate),
      (error) =>
        error instanceof AccessEmailMessageError &&
        error.code === "duplicate_entry_id",
    );
    await assert.rejects(
      renderAccessEntriesEmailContent(
        {
          buyerName: invalidToken.buyerName,
          publicRef: invalidToken.publicRef,
          sourceName: invalidToken.sourceName,
          accessDate: invalidToken.accessDate,
          entries: invalidToken.entries,
        },
        (checkinToken) =>
          generateAccessEntryQrPngForBaseUrl(
            checkinToken,
            invalidToken.qrBaseUrl,
          ),
      ),
      (error) =>
        error instanceof AccessEmailMessageError &&
        error.code === "qr_generation_failed",
    );
    await assert.rejects(
      buildAccessEntriesEmailMessage({
        ...fixtureInput(),
        buyerEmail: "invalid",
      }),
      (error) =>
        error instanceof AccessEmailMessageError &&
        error.code === "invalid_recipient",
    );
    await assert.rejects(
      buildAccessEntriesEmailMessage({
        ...fixtureInput(),
        from: "Tairet <invalid>",
      }),
      (error) =>
        error instanceof AccessEmailMessageError && error.code === "invalid_from",
    );
    await assert.rejects(
      buildAccessEntriesEmailMessage({
        ...fixtureInput(),
        buyerEmail: "   ",
      }),
      (error) =>
        error instanceof AccessEmailMessageError &&
        error.code === "invalid_recipient",
    );

    const namedFrom = await buildAccessEntriesEmailMessage({
      ...fixtureInput(),
      from: "  Tairet Entradas <ACCESS@Example.Test>  ",
    });
    assert.equal(
      namedFrom.message.from,
      "Tairet Entradas <ACCESS@Example.Test>",
    );
    const simpleFrom = await buildAccessEntriesEmailMessage({
      ...fixtureInput(),
      from: "  ACCESS@Example.Test  ",
    });
    assert.equal(simpleFrom.message.from, "ACCESS@Example.Test");
  });
});
