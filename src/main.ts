import App from "./app/app";
import { Preloader } from "./utils/preloader";

const container = document.getElementById("app") as HTMLElement;
if (!container) {
  console.error("App element not found!");
} else {
  console.log("start preloading");
  Preloader.init().then((assets) => {
    const app = new App();
    app.init(container, assets);
  });
}
