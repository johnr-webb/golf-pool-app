const CODE_TO_ISO2: Record<string, string> = {
  USA: "US", GBR: "GB", ENG: "GB", SCO: "GB", WAL: "GB", NIR: "GB",
  SWE: "SE", JPN: "JP", KOR: "KR", AUS: "AU", CAN: "CA", RSA: "ZA",
  ARG: "AR", ESP: "ES", FRA: "FR", GER: "DE", ITA: "IT", IRL: "IE",
  NOR: "NO", DEN: "DK", FIN: "FI", BEL: "BE", NED: "NL", AUT: "AT",
  CHN: "CN", IND: "IN", THA: "TH", TPE: "TW", COL: "CO", CHI: "CL",
  MEX: "MX", BRA: "BR", NZL: "NZ", PHI: "PH", PAR: "PY", VEN: "VE",
  PUR: "PR", ZIM: "ZW",
};

export function countryCodeToFlag(code: string): string {
  const iso2 = CODE_TO_ISO2[code.toUpperCase()] ?? code.slice(0, 2).toUpperCase();
  if (iso2.length !== 2) return code;
  const [a, b] = iso2.split("");
  return (
    String.fromCodePoint(0x1f1e6 + a.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + b.charCodeAt(0) - 65)
  );
}
