import { AvatarCropper } from "notionclub-infra";

const noop = () => {};

// react-easy-crop loads the image via a real <img> element. We pass a small
// inline SVG data-URI (brand-coloured) so the cropper has something to crop
// in the static preview without any network request.
const SAMPLE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e0625a"/>
          <stop offset="1" stop-color="#8a6cf2"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g)"/>
      <circle cx="300" cy="240" r="110" fill="rgba(255,255,255,0.9)"/>
      <rect x="150" y="380" width="300" height="180" rx="90" fill="rgba(255,255,255,0.9)"/>
    </svg>`,
  );

export const Default = () => (
  <AvatarCropper
    imageSrc={SAMPLE_IMAGE}
    mimeType="image/png"
    onConfirm={noop}
    onCancel={noop}
  />
);

export const EnvoiEnCours = () => (
  <AvatarCropper
    imageSrc={SAMPLE_IMAGE}
    mimeType="image/png"
    onConfirm={noop}
    onCancel={noop}
    submitting
  />
);
