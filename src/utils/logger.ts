import { AdzeTransportFile } from "@adze/transport-file";
import adze, { setup } from "adze";

const fileTransport = new AdzeTransportFile({
	directory: "./logs",
	frequency: "12h",
	date_format: "YMDH",
});
await fileTransport.load();
setup({
	activeLevel: "info",
	format: "pretty",
	middleware: [fileTransport],
});
const logger = adze.withEmoji.timestamp.namespace("FSD").seal();

export default logger;
