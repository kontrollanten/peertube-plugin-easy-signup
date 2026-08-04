export class UiBuilder {
  rootEl: HTMLElement

  constructor(rootEl: HTMLElement) {
    this.rootEl = rootEl
  }

  renderRow(firstCol: HTMLElement[], secondCol?: HTMLElement[]): HTMLElement {
    return this.div(
      [
        this.div(firstCol, secondCol ? "col-12 col-lg-4 col-xl-3" : "col-12"),
        ...(secondCol ? [this.div(secondCol, "col-12 col-lg-8 col-xl-9")] : []),
      ],
      "row",
    )
  }

  div(children: HTMLElement[], className?: string): HTMLElement {
    const elem = document.createElement("div")

    if (className) {
      elem.className = className
    }

    children.forEach((c) => elem.appendChild(c))

    return elem
  }

  a(innerHTML: string, attrs?: Record<string, string>): HTMLElement {
    const elem = document.createElement("a")
    elem.innerHTML = innerHTML

    for (const attr in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, attr)) {
        continue
      }

      elem.setAttribute(attr, attrs[attr])
    }

    return elem
  }

  h2(innerText: string, className?: string): HTMLElement {
    const elem = document.createElement("h2")
    elem.innerText = innerText

    if (className) {
      elem.classList.add(className)
    }

    return elem
  }

  h3(innerText: string): HTMLElement {
    const elem = document.createElement("h2")
    elem.innerText = innerText

    return elem
  }

  p(innerText: string, className?: string): HTMLElement {
    const elem = document.createElement("p")
    elem.innerHTML = innerText

    if (className) {
      elem.className = className
    }

    return elem
  }

  img(src: string, className: string): HTMLElement {
    const elem = document.createElement("img")
    elem.src = src
    elem.className = className

    return elem
  }

  ul(children: string[], className?: string): HTMLElement {
    const ul = document.createElement("ul")

    if (className) {
      ul.className = className
    }

    children.forEach((child) => {
      const li = document.createElement("li")
      li.innerText = child
      ul.appendChild(li)
    })

    return ul
  }

  form(children: HTMLElement[]): HTMLFormElement {
    const form = document.createElement("form")

    for (const child of children) {
      form.appendChild(child)
    }

    return form
  }

  label(value: string, inputElement: HTMLElement): HTMLElement[] {
    const inputId = `input-${Math.round(Math.random() * 1_000_000)}`
    inputElement.setAttribute("id", inputId)

    const label = document.createElement("label")
    label.innerText = value
    label.setAttribute("for", inputId)

    return [label, inputElement]
  }

  input(type: "text" | "email", placeholder: string): HTMLInputElement {
    const input = document.createElement("input")
    input.setAttribute("type", type)
    input.setAttribute("placeholder", placeholder)

    return input
  }

  button(value: string, className: string): HTMLButtonElement {
    const button = document.createElement("button")
    button.className = className
    button.innerText = value

    return button
  }
}
