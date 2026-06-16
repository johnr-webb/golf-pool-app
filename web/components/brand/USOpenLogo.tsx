import Image from "next/image";
import logo from "@/public/us-open-logo.png";

/**
 * Official full-color U.S. Open lockup (silver trophy + red "US" + navy "OPEN").
 * Intrinsic asset ratio is 2578x968 (~2.66:1); width drives the rendered size.
 */
export function USOpenLogo({
  height = 40,
  priority = false,
}: {
  height?: number;
  priority?: boolean;
}) {
  const width = Math.round(height * (2578 / 968));
  return (
    <Image
      src={logo}
      alt="U.S. Open"
      height={height}
      width={width}
      priority={priority}
      style={{ height, width: "auto" }}
    />
  );
}
