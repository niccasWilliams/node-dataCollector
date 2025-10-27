// src/emails/partials/EmailSignature.tsx

import * as React from "react";
import { Text } from "@react-email/components";

export const EmailSignature = () => (
  <div style={{
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    maxWidth: 400,
    margin: "0 auto",
    padding: 0,
  }}>
    <div style={{ borderLeft: "4px solid #EAAC3F", paddingLeft: 16, marginTop: 32 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", color: "#1f2937", marginBottom: 12 }}>Geile Mukke Picknick</Text>
      <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 12 }}>
        <span style={{ color: "#9ca3af", fontSize: 12, marginRight: 8 }}>✉</span>
        <a href="mailto:picknick@geilemukke.de" style={{ color: "#eaac3f", textDecoration: "none" }}>
          picknick@geilemukke.de
        </a><br />
        <span style={{ color: "#9ca3af", fontSize: 12, marginRight: 8 }}>🌐</span>
        <a href="https://picknick.geilemukke.de" style={{ color: "#eaac3f", textDecoration: "none" }}>
          picknick.geilemukke.de
        </a>
      </Text>
    </div>
    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
      <Text style={{ fontSize: 12, color: "#9ca3af" }}>
        <strong style={{ color: "#6b7280" }}>Veranstalter:</strong> Geile Mukke Picknick<br />
        <strong style={{ color: "#6b7280" }}>Support:</strong> support@geilemukke.de<br />
        <em>Diese Nachricht kann vertrauliche Informationen enthalten und ist nur für die bezeichneten Empfänger bestimmt.</em>
      </Text>
    </div>
  </div>
);