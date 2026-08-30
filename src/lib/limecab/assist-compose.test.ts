import test from "node:test";
import assert from "node:assert/strict";

import {
  activeMentionAt,
  applyMention,
  assistLookupQuery,
  composeAssistQuery,
  filterMentions,
  insertMentionTrigger,
  riderNoteFromAssistQuery,
  shouldRefreshAssistQueryForPhoto,
  ASSIST_PLUGIN_MENTIONS,
} from "./assist-compose.ts";

test("activeMentionAt finds @token before the caret", () => {
  assert.deepEqual(activeMentionAt("go @sho", 7), {
    start: 3,
    query: "sho",
  });
  // Caret past the trailing space — mention is closed.
  assert.equal(activeMentionAt("go @sho now", 8), null);
  assert.equal(activeMentionAt("email@x.com", 11), null);
  assert.deepEqual(activeMentionAt("@", 1), { start: 0, query: "" });
});

test("insertMentionTrigger adds @ with a leading space when needed", () => {
  assert.deepEqual(insertMentionTrigger(""), { text: "@", caret: 1 });
  assert.deepEqual(insertMentionTrigger("ride"), {
    text: "ride @",
    caret: 6,
  });
  assert.deepEqual(insertMentionTrigger("ride ", 5), {
    text: "ride @",
    caret: 6,
  });
});

test("applyMention completes the active token", () => {
  const shop = ASSIST_PLUGIN_MENTIONS.find((m) => m.id === "shop")!;
  assert.deepEqual(applyMention("order @sh", 9, shop), {
    text: "order @shop ",
    caret: 12,
  });
});

test("filterMentions matches id and label", () => {
  const hits = filterMentions("sho", ASSIST_PLUGIN_MENTIONS);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.id, "shop");
  assert.ok(filterMentions("", ASSIST_PLUGIN_MENTIONS).length >= 5);
});

test("assistLookupQuery suppresses lookup while mentioning", () => {
  assert.equal(assistLookupQuery("@sho"), "");
  assert.equal(assistLookupQuery("flowers tonight"), "flowers tonight");
});

test("composeAssistQuery prefixes recipient stops and photo", () => {
  assert.equal(
    composeAssistQuery("flowers", {
      photoName: "bouquet.jpg",
      photoUrl: null,
      photoPreviewUrl: null,
      wantsStops: true,
      recipientName: "Maya",
      photoClassification: null,
    }),
    "for Maya, with stops: flowers",
  );
  assert.equal(
    composeAssistQuery("  ", {
      photoName: "IMG_1234.jpg",
      photoUrl: null,
      photoPreviewUrl: null,
      wantsStops: false,
      recipientName: null,
      photoClassification: null,
    }),
    "photo:IMG_1234.jpg",
  );
});

test("composeAssistQuery uses photo classification as the shop sentence", () => {
  const classified = {
    category: "hardware" as const,
    query: "deliver hex nuts now",
    items: [{ label: "hex nuts" }],
    storeHints: ["hardware store", "home improvement"],
    source: "model" as const,
  };
  assert.equal(
    composeAssistQuery("", {
      photoName: "nut.jpg",
      photoUrl: "https://blob.example/assist-photos/nut.jpg",
      photoPreviewUrl: null,
      wantsStops: false,
      recipientName: null,
      photoClassification: classified,
    }),
    "deliver hex nuts now",
  );
  assert.equal(
    composeAssistQuery("deliver hex nuts now", {
      photoName: "nut.jpg",
      photoUrl: "https://blob.example/assist-photos/nut.jpg",
      photoPreviewUrl: null,
      wantsStops: false,
      recipientName: null,
      photoClassification: classified,
    }),
    "deliver hex nuts now",
  );
  assert.equal(
    composeAssistQuery("for tonight please", {
      photoName: "nut.jpg",
      photoUrl: "https://blob.example/assist-photos/nut.jpg",
      photoPreviewUrl: null,
      wantsStops: false,
      recipientName: null,
      photoClassification: classified,
    }),
    "deliver hex nuts now: for tonight please",
  );
});

test("composeAssistQuery merges pencil photo with need more of these", () => {
  const classified = {
    category: "home" as const,
    query: "deliver pencils now",
    items: [{ label: "pencils" }],
    storeHints: ["office supply", "general merchandise"],
    source: "model" as const,
  };
  assert.equal(
    composeAssistQuery("need more of these", {
      photoName: "pngtree-pencil-with-orange-body-png-image_21226753.png",
      photoUrl: "https://blob.example/assist-photos/pencil.png",
      photoPreviewUrl: "blob:http://localhost/preview",
      wantsStops: false,
      recipientName: null,
      photoClassification: classified,
    }),
    "deliver pencils now: need more of these",
  );
});

test("composeAssistQuery keeps unclassified photo + referential note as shop", () => {
  assert.equal(
    composeAssistQuery("need more of these", {
      photoName: "IMG_9999.jpg",
      photoUrl: null,
      photoPreviewUrl: "blob:http://localhost/x",
      wantsStops: false,
      recipientName: null,
      photoClassification: null,
    }),
    "buy what is in the photo now: need more of these",
  );
});

test("shouldRefreshAssistQueryForPhoto when photo attaches or classifies", () => {
  const empty = {
    photoName: null,
    photoUrl: null,
    photoPreviewUrl: null,
    wantsStops: false,
    recipientName: null,
    photoClassification: null,
  };
  const attached = {
    ...empty,
    photoName: "IMG_1.jpg",
    photoPreviewUrl: "blob:x",
  };
  const classified = {
    ...attached,
    photoClassification: {
      category: "home" as const,
      query: "deliver pencils now",
      items: [{ label: "pencils" }],
      storeHints: ["office supply"],
      source: "model" as const,
    },
  };
  assert.equal(shouldRefreshAssistQueryForPhoto(empty, attached), true);
  assert.equal(shouldRefreshAssistQueryForPhoto(attached, classified), true);
  assert.equal(shouldRefreshAssistQueryForPhoto(classified, classified), false);
});

test("riderNoteFromAssistQuery peels compose stamps before refresh", () => {
  const draft = {
    photoName: "IMG_1.jpg",
    photoUrl: null,
    photoPreviewUrl: "blob:x",
    wantsStops: false,
    recipientName: null,
    photoClassification: {
      category: "home" as const,
      query: "deliver pencils now",
      items: [{ label: "pencils" }],
      storeHints: ["office supply"],
      source: "model" as const,
    },
  };
  assert.equal(
    riderNoteFromAssistQuery(
      "buy what is in the photo now: need more of these",
      { ...draft, photoClassification: null },
    ),
    "need more of these",
  );
  assert.equal(
    riderNoteFromAssistQuery("deliver pencils now: need more of these", draft),
    "need more of these",
  );
  assert.equal(
    composeAssistQuery(
      riderNoteFromAssistQuery(
        "buy what is in the photo now: need more of these",
        { ...draft, photoClassification: null },
      ),
      draft,
    ),
    "deliver pencils now: need more of these",
  );
});
