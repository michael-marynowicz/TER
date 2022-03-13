export default class pedalboardGui extends HTMLElement {
  constructor(plug) {
    super();
    this._plug = plug;
    this._plug.gui = this;

    this._root = this.attachShadow({ mode: "open" });

    this.init();
  }

  async init() {
    this.setStyle();

    this.preview = await this.loadThumbnails();
    this._root.appendChild(this.preview);

    this.board = document.createElement("div");
    this.board.id = "board";
    this._root.appendChild(this.board);
  }

  async loadThumbnails() {
    let pedals = Object.keys(this._plug.pedals);
    let urls = await Promise.all(
      pedals.map((el) => {
        let pedal = this._plug.pedals[el];
        let thumbnail = pedal.descriptor.thumbnail;
        if (thumbnail == "") {
          return "../pedalboard/Gui/notfound.jpg";
        }
        return `${pedal.url}${thumbnail}`;
      })
    );

    let preview = document.createElement("div");
    preview.id = "preview";

    urls.forEach((el, index) => {
      let img = document.createElement("img");
      img.src = el;
      img.addEventListener("click", () => this._plug.addPedal(pedals[index]), {
        passive: false,
      });
      preview.appendChild(img);
    });

    return preview;
  }

  addPlugin(instance, id) {
    instance.createGui().then((gui) => {
      gui.draggable = true;
      gui.ondragstart = (event) => {
        this.DragStartX = event.x;
      };
      gui.ondragend = (event) => {
        let origin = event.target;
        let target = this._root.elementFromPoint(event.x, event.y);
        let parent = target.parentNode;

        if (parent == this.board && origin != target) {
          this._plug.pedalboardNode.disconnectAll(parent.childNodes);
          if (this.DragStartX > event.x) {
            parent.insertBefore(origin, target);
          } else {
            parent.insertBefore(target, origin);
          }
          this._plug.pedalboardNode.reconnectAll(parent.childNodes);
        }
      };
      gui.id = id;
      this._root.getElementById("board").appendChild(gui);
    });
  }

  setStyle() {
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "../pedalboard/Gui/style.css");

    this._root.appendChild(linkElem);
  }
}

customElements.define("wap-pedalboard", pedalboardGui);
