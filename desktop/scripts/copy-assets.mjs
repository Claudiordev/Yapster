// tsc only emits .ts files; the picker's HTML has to sit next to its compiled script.
import { cpSync } from "node:fs";

cpSync("src/picker/picker.html", "dist/picker/picker.html");
