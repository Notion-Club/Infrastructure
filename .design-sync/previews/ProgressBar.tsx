import { ProgressBar } from "notionclub-infra";

export const Default = () => (
  <div style={{ width: 320 }}>
    <ProgressBar percent={58} />
  </div>
);

export const WithLabels = () => (
  <div style={{ width: 320 }}>
    <ProgressBar percent={42} from="5 / 12 modules" to="42 %" />
  </div>
);

export const Complete = () => (
  <div style={{ width: 320 }}>
    <ProgressBar percent={100} from="Formation terminée" to="100 %" />
  </div>
);
