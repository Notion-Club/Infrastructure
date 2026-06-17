import { PhoneField } from "notionclub-infra";

const noop = () => {};

export const Rempli = () => (
  <div style={{ width: 520 }}>
    <PhoneField
      id="phone-filled"
      label="Numéro de téléphone"
      value={{ countryCode: "FR", national: "6 12 34 56 78" }}
      onChange={noop}
      helper="Utilisé pour vous prévenir des prochains appels de coaching."
    />
  </div>
);

export const Vide = () => (
  <div style={{ width: 520 }}>
    <PhoneField
      id="phone-empty"
      label="Numéro de téléphone"
      value={{ countryCode: "FR", national: "" }}
      onChange={noop}
    />
  </div>
);

export const AutrePays = () => (
  <div style={{ width: 520 }}>
    <PhoneField
      id="phone-be"
      label="Numéro de téléphone"
      value={{ countryCode: "BE", national: "470 12 34 56" }}
      onChange={noop}
    />
  </div>
);
