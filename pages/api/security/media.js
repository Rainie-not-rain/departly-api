export { default } from "../../../api/security/media.js";

export const config = {
  api: { bodyParser: { sizeLimit: "3mb" } },
  maxDuration: 45,
};
