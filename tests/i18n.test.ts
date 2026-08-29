import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale, t } from "../src/i18n";

describe("interface localization", () => {
  afterEach(() => setLocale("en"));

  it.each([
    ["en", "Home"],
    ["tr", "Ana sayfa"],
    ["es", "Inicio"],
    ["de", "Start"],
    ["fr", "Accueil"],
  ] as const)("provides the %s interface", (locale, expected) => {
    setLocale(locale);

    expect(getLocale()).toBe(locale);
    expect(t("Home")).toBe(expected);
  });

  it("interpolates dynamic interface messages", () => {
    setLocale("tr");

    expect(t("Added {name}", { name: "Karar" })).toBe("Karar eklendi");
    expect(t("Tap canvas to place {name}", { name: "Seçim" })).toBe("Seçim yerleştirmek için tuvale dokun");
    expect(t("{count} nodes", { count: 4 })).toBe("4 kutu");
    expect(t("Replace current diagram?")).toBe("Mevcut diyagram değiştirilsin mi?");
  });

  it("leaves scripting keywords and user content unchanged", () => {
    setLocale("fr");

    expect(t("connect")).toBe("connect");
    expect(t("Kullanıcının kendi metni")).toBe("Kullanıcının kendi metni");
  });
});
