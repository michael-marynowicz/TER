export default class pedalboardGui extends HTMLElement {
  constructor(plug) {
    super();
    this._plug = plug;
    this._plug.gui = this;

    this._root = this.attachShadow({ mode: "open" });

    this.init();
  }

  // Initlialise the differents elements of the gui
  async init() {
    this.setStyle();

    this.preview = await this.loadThumbnails();
    this._root.appendChild(this.preview);

    this.board = document.createElement("div");
    this.board.id = "board";
    this.dragEvent = { end: false };
    this._root.appendChild(this.board);

    this.saveMenu = await this.loadSaves();
    this._root.appendChild(this.saveMenu);
  }

  // Load the thumbnails of the plugins
  async loadThumbnails() {
    let pedals = Object.keys(this._plug.pedals);
    let keywords = { all: [] };
    let urls = await Promise.all(
      pedals.map((el) => {
        let pedal = this._plug.pedals[el];
        keywords["all"].push(el);
        pedal.descriptor.keywords.forEach((k) => {
          if (!(k in keywords)) {
            keywords[k] = [];
          }
          keywords[k].push(el);
        });
        let thumbnail = pedal.descriptor.thumbnail;
        if (thumbnail == "") {
          return "../pedalboard/Gui/assets/notfound.jpg";
        }
        return `${pedal.url}${thumbnail}`;
      })
    );

    let preview = document.createElement("div");
    preview.id = "preview";

    let select = document.createElement("select");
    const refreshImages = (select) => {
      let keys = Object.keys(keywords);
      let currentKey = keys[select.selectedIndex];
      this.images.innerHTML = "";
      keywords[currentKey].forEach((el) => {
        this.images.appendChild(this._plug.pedals[el].img);
      });
    };
    select.addEventListener("change", (event) => refreshImages(event.target));

    for (let key of Object.keys(keywords)) {
      let filter = document.createElement("option");
      filter.innerHTML = key;
      select.appendChild(filter);
    }
    preview.appendChild(select);

    this.images = document.createElement("div");
    urls.forEach((el, index) => {
      let img = document.createElement("img");
      img.src = el;
      img.addEventListener("click", () => this._plug.addPedal(pedals[index]), {
        passive: false,
      });
      this._plug.pedals[pedals[index]].img = img;
    });
    preview.appendChild(this.images);

    refreshImages(select);
    return preview;
  }

  // Create the save panel
  async loadSaves() {
    if (window.localStorage["pedalBoardSaves"] == undefined) {
      let file = await fetch("../pedalboard/saves.json");
      let json = await file.json();
      window.localStorage["pedalBoardSaves"] = JSON.stringify(json);
    }
    this.folders = JSON.parse(window.localStorage["pedalBoardSaves"]);

    let keys = Object.keys(this.folders);

    let savesInfos = document.createElement("div");
    savesInfos.id = "savesInfos";

    this.categories = this.createFolders(keys);
    this.categories.id = "categories";

    this.saves = document.createElement("ul");
    this.saves.id = "saves";

    this.infos = document.createElement("infos");
    this.infos.id = "infos";

    let foldersTitle = document.createElement("h1");
    foldersTitle.innerHTML = "Categories";
    let savesTitle = document.createElement("h1");
    savesTitle.innerHTML = "Saves";
    let infosTitle = document.createElement("h1");
    infosTitle.innerHTML = "Information";

    savesInfos.appendChild(foldersTitle);
    savesInfos.appendChild(savesTitle);
    savesInfos.appendChild(infosTitle);
    savesInfos.appendChild(this.categories);
    savesInfos.appendChild(this.saves);
    savesInfos.appendChild(this.infos);
    return savesInfos;
  }

  // Create a list element modifiable with double click and triggering an event with a single click
  createSaveElement(folderNameCallBack, key) {
    let el = document.createElement("li");
    el.classList.add("saveElement");

    let text = document.createElement("span");
    text.innerHTML = key;
    const clickEventCallBack = () => this.loadSave(folderNameCallBack, text.innerHTML);
    text.addEventListener("click", clickEventCallBack);
    el.append(text);

    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => {
      let canUpdateSaveName = this.updateSave(folderNameCallBack, e.target);
      if (canUpdateSaveName) {
        text.innerHTML = e.target.value;
        text.addEventListener("click", clickEventCallBack);
      } else {
        setTimeout(() => input.focus(), 1);
      }
    });

    let save = document.createElement("button");
    save.classList.add("saveButton");
    save.addEventListener("click", () => this.updateSave(folderNameCallBack, text, save));
    el.append(save);

    let edit = document.createElement("button");
    edit.classList.add("editButton");
    edit.addEventListener("click", () => {
      text.removeEventListener("click", clickEventCallBack);
      input.value = text.innerHTML;
      input.placeholder = input.value;
      text.innerHTML = "";
      text.appendChild(input);
      input.focus();
    });
    el.append(edit);

    let remove = document.createElement("button");
    remove.classList.add("removeButton");
    remove.addEventListener("click", () => this.deleteSave(folderNameCallBack, () => text.innerHTML, el));
    el.append(remove);

    return el;
  }

  createCategorieElement(name) {
    let el = document.createElement("li");
    el.classList.add("categorieElement");

    const clickEventCallBack = () => this.showFolder(() => text.innerHTML);

    let text = document.createElement("span");
    text.innerHTML = name;
    text.addEventListener("click", clickEventCallBack);
    el.appendChild(text);

    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => {
      if (this.renameFolder(e.target.placeholder, e.target.value)) {
        text.innerHTML = e.target.value;
        text.addEventListener("click", clickEventCallBack);
      } else {
        setTimeout(() => input.focus(), 1);
      }
    });

    let edit = document.createElement("button");
    edit.classList.add("editButton");
    edit.addEventListener("click", () => {
      text.removeEventListener("click", clickEventCallBack);
      input.value = text.innerHTML;
      input.placeholder = input.value;
      text.innerHTML = "";
      text.appendChild(input);
      input.focus();
    });
    el.append(edit);

    let remove = document.createElement("button");
    remove.classList.add("removeButton");
    remove.addEventListener("click", () => this.deleteFolder(() => text.innerHTML, el));
    el.append(remove);

    return el;
  }

  // Create the list of folders
  createFolders(keys) {
    let folders = document.createElement("ul");

    let button = document.createElement("button");
    button.innerHTML = "New Categorie";
    button.addEventListener("click", () => {
      const key = "";
      let saveInput = this.createCategorieElement(key);
      this.categories.appendChild(saveInput);
      this.folders[key] = [];
      window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
      saveInput.lastChild.previousSibling.click();
    });
    folders.appendChild(button);

    keys.forEach((folder) => {
      let el = this.createCategorieElement(folder);
      folders.appendChild(el);
    });

    return folders;
  }

  // Show content of the folder
  showFolder(folderNameCallBack) {
    this.saves.innerHTML = "";
    const folder = folderNameCallBack();
    let button = document.createElement("button");
    button.innerHTML = "New Save";
    button.addEventListener("click", () => {
      const key = "";
      let saveInput = this.createSaveElement(folderNameCallBack, key);
      this.saves.appendChild(saveInput);
      this.folders[folder][key] = [];
      window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
      saveInput.lastChild.previousSibling.click();
    });
    this.saves.appendChild(button);

    Object.keys(this.folders[folder]).forEach((key) => {
      this.saves.appendChild(this.createSaveElement(folderNameCallBack, key));
    });
  }

  // Load the save to the audioNode au show it's informations
  loadSave(folderNameCallBack, key) {
    const folder = folderNameCallBack();
    this.infos.innerHTML = "";
    this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
    this.board.innerHTML = "";
    this._plug.loadSave(this.folders[folder][key]);

    let cat = document.createElement("h4");
    cat.innerHTML = `Categorie: ${folder}`;

    let name = document.createElement("h4");
    name.innerHTML = `Name: ${key}`;

    let ul = document.createElement("ul");
    this.folders[folder][key].forEach((node) => {
      let li = document.createElement("li");
      li.innerHTML = node.name;
      ul.appendChild(li);
    });

    this.infos.appendChild(cat);
    this.infos.appendChild(name);
    this.infos.appendChild(ul);
  }

  deleteSave(folderNameCallBack, saveNameCallBack, node) {
    delete this.folders[folderNameCallBack()][saveNameCallBack()];
    window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
    this.saves.removeChild(node);
  }

  deleteFolder(folderNameCallBack, node) {
    const folder = folderNameCallBack();
    if (Object.keys(this.folders[folder]).length != 0) {
      alert("Empty the folder before trying to delete it");
    } else {
      delete this.folders[folder];
      window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
      this.categories.removeChild(node);
    }
  }

  // Update the content of the save in the folder, the name of the save is given by the element
  updateSave(folderNameCallBack, element) {
    const folder = folderNameCallBack();
    if (element.tagName === "INPUT") {
      return this.renameSave(folder, element.placeholder, element.value);
    } else {
      this._plug.pedalboardNode.getState(this.board.childNodes).then((save) => {
        this.folders[folder][element.innerHTML] = save;
      });
    }
    window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
    return true;
  }

  renameSave(folder, oldName, newName) {
    if (newName.trim().length == 0) {
      alert("Invalid save name");
      return false;
    }
    if (newName != oldName) {
      if (this.folders[folder][newName]) {
        alert("This save name is already used");
        return false;
      }
      this.folders[folder][newName] = this.folders[folder][oldName];
      delete this.folders[folder][oldName];
    }
    return true;
  }

  renameFolder(oldName, newName) {
    if (newName.trim().length == 0) {
      alert("Invalid folder name");
      return false;
    }
    if (newName != oldName) {
      if (this.folders[newName]) {
        alert("This folder name is already used");
        return false;
      }
      this.folders[newName] = this.folders[oldName];
      delete this.folders[oldName];
    }
    window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
    return true;
  }

  // Add the plugin to the board
  addPlugin(instance, img, id) {
    instance.createGui().then((gui) => {
      let wrapper = document.createElement("article");
      wrapper.draggable = true;
      wrapper.ondragstart = (event) => {
        event.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
        this.dragEvent = { x: event.x, origin: wrapper, end: false };
      };
      wrapper.ondragend = () => {
        this.dragEvent.end = true;
      };

      let infos = document.createElement("header");
      infos.innerHTML = instance.name;

      let cross = document.createElement("img");
      cross.src = "./pedalboard/Gui/assets/croix.png";
      cross.addEventListener("click", () => {
        this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
        this.board.removeChild(wrapper);
        this._plug.pedalboardNode.connectNodes(this.board.childNodes);
      });
      infos.append(cross);
      wrapper.appendChild(infos);
      wrapper.appendChild(gui);
      wrapper.id = id;
      wrapper.classList.add("nodeArticle");

      this.board.addEventListener("mouseover", (event) => {
        if (this.dragEvent.end) {
          let origin = this.dragEvent.origin;
          let target = this.getWrapper(this._root.elementFromPoint(event.x, event.y));

          if (target.parentNode == this.board && origin != target) {
            this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
            this.board.insertBefore(origin, this.dragEvent.x > event.x ? target : target.nextSibling);
            this._plug.pedalboardNode.connectNodes(this.board.childNodes);
          }
          this.dragEvent.end = false;
        }
      });

      this.board.appendChild(wrapper);
    });
  }

  // Return the nodeArticle when selecting child node insted of itself with drag and drop
  getWrapper(element) {
    switch (element.tagName) {
      case "IMG":
        return element.parentNode.parentNode;
      case "ARTICLE":
        return element;
      default:
        return element.parentNode;
    }
  }

  // Link the css
  setStyle() {
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "../pedalboard/Gui/style.css");

    this._root.appendChild(linkElem);
  }
}

customElements.define("wap-pedalboard", pedalboardGui);
