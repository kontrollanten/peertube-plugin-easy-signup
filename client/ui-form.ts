import { UiBuilder } from "./ui-builder"

const USER_USERNAME_REGEX_CHARACTERS = "[a-z0-9][a-z0-9._]" // Copied from Peertube
let clientId: string | null = null
let clientSecret: string | null = null
let translate: (str: string) => Promise<string> = async (str: string) =>
  Promise.resolve(str) // Fallback

const fetchClientCredentials = async (): Promise<void> => {
  return fetch("/api/v1/oauth-clients/local")
    .then(
      async (res) =>
        (await res.json()) as { client_id: string; client_secret: string },
    )
    .then((res) => {
      clientId = res.client_id
      clientSecret = res.client_secret

      console.log({ clientId, clientSecret })
    })
}

void (async () => {
  let waitTime = 1000
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-unmodified-loop-condition
  while (!clientId && !clientSecret) {
    try {
      await fetchClientCredentials()
    } catch (err) {
      console.error("fetchClientCredentials", err)
      // eslint-disable-next-line promise/avoid-new
      await new Promise((resolve) => {
        waitTime = waitTime * 1.5
        setTimeout(resolve, waitTime)
      })
    }
  }
})()

function generatePwd(length: number): string {
  let result = ""
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const { length: charactersLength } = characters

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

function objectToUrlEncoded(obj: Record<string, string>): string {
  const str: string[] = []
  for (const key of Object.keys(obj)) {
    str.push(encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]))
  }

  return str.join("&")
}

const parseRegistrationResult = async (registration: {
  state: { id: number }
}): Promise<
  | { success: true; isPending: boolean }
  | { success: false; errorFields: string[]; error: string }
> => {
  if (registration.state.id === 1) {
    return { success: true, isPending: true }
  }

  if (registration.state.id === 2) {
    return {
      success: false,
      errorFields: [],
      error: await translate("Your registration request was denied."),
    }
  }

  return { success: true, isPending: false }
}

const handleRegistration = async ({
  email,
  username,
}: {
  email: string
  username: string
}): Promise<
  | { success: true; isPending: boolean; password: string }
  | { success: false; errorFields: string[]; error: string }
> => {
  const password = generatePwd(15)

  const response = await fetch("/api/v1/users/register", {
    method: "post",
    body: JSON.stringify({
      username,
      email,
      password,
    }),
    headers: {
      "content-type": "application/json",
    },
  })

  let jsonResponse: unknown = null

  try {
    jsonResponse = await response.json()
  } catch (e: unknown) {}

  if (response.ok) {
    const registration = jsonResponse as {
      state: { id: number }
    }
    console.log("Registration response", registration)

    const result = await parseRegistrationResult(registration)

    if (result.success) {
      return {
        ...result,
        password,
      }
    }

    return result
  }

  let errorFields: string[] = []

  try {
    errorFields = Object.keys(
      (jsonResponse as { "invalid-params": Record<string, unknown> })[
        "invalid-params"
      ],
    )
  } catch (e: unknown) {}

  console.error("Bad response", response)

  return {
    success: false,
    errorFields,
    error: await translate(
      response.status === 403
        ? "User registration is not available."
        : response.status === 409
          ? "An user with this email or username already exists."
          : "An unknown error occurred.",
    ),
  }
}

const handleAuthentication = async ({
  email,
  username,
  password,
}: {
  email: string
  username: string
  password: string
}): Promise<boolean> => {
  if (clientId === null || clientSecret === null) {
    console.error("Failed to get client credentials", {
      clientId,
      clientSecret,
    })

    return false
  }

  {
    const body = {
      client_id: clientId,
      client_secret: clientSecret,
      response_type: "code",
      grant_type: "password",
      scope: "upload",
      username: (username || "").trim(),
      password,
    }

    const tokenResponse = await fetch("/api/v1/users/token", {
      method: "post",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: objectToUrlEncoded(body),
    })
    const jsonResponse = (await tokenResponse.json()) as {
      access_token: string
      token_type: string
      refresh_token: string
    }

    const meResponse = await fetch("/api/v1/users/me", {
      headers: {
        authorization: `${jsonResponse.token_type} ${jsonResponse.access_token}`,
      },
    })
    const meJson = (await meResponse.json()) as {
      id: number
      role: { id: number }
    }

    window.localStorage.setItem("id", meJson.id.toString())
    window.localStorage.setItem("role", meJson.role.id.toString())
    window.localStorage.setItem("username", username)
    window.localStorage.setItem("email", email)

    window.localStorage.setItem("access_token", jsonResponse.access_token)
    window.localStorage.setItem("refresh_token", jsonResponse.refresh_token)
    window.localStorage.setItem("token_type", jsonResponse.token_type)

    console.log("Login successfully")

    location.reload()

    return true
  }
}

const onSubmit = async ({
  email,
  username,
}: {
  email: string
  username: string
}): Promise<
  | { success: true; isPending: boolean; isLoggedIn: boolean }
  | { success: false; error: string }
> => {
  const registrationResult = await handleRegistration({ email, username })

  if (!registrationResult.success) {
    return { success: false, error: registrationResult.error }
  }

  try {
    const authResult = await handleAuthentication({
      email,
      username,
      password: registrationResult.password,
    })

    return { success: true, isLoggedIn: authResult, isPending: false }
  } catch (err) {
    console.error(err)

    return {
      success: true,
      isLoggedIn: false,
      isPending: false,
    }
  }
}

export const buildForm = async (
  rootEl: HTMLElement,
  ptTranslate: (str: string) => Promise<string>,
): Promise<void> => {
  translate = ptTranslate
  const uiBuilder = new UiBuilder(rootEl)

  rootEl.classList.add(
    "easy-signup-form",
    "peertube-plugin-easy-signup",
    "margin-content",
    "pt-4",
  )

  const inputEmail = uiBuilder.input("email", await translate("Email"))
  inputEmail.setAttribute("autocomplete", "email")
  inputEmail.setAttribute("id", "email")
  inputEmail.setAttribute("required", "true")
  inputEmail.setAttribute("inputmode", "email")
  inputEmail.setAttribute("autofocus", "true")

  const inputUsername = uiBuilder.input("text", await translate("Username"))
  inputUsername.setAttribute("required", "true")
  inputUsername.setAttribute("inputmode", "text")
  inputUsername.setAttribute("autocapitalize", "off")

  {
    const observer = new MutationObserver(() => {
      if (rootEl.contains(inputEmail)) {
        inputEmail.focus()
        observer.disconnect()
      }
    })

    observer.observe(rootEl, {
      attributes: false,
      childList: true,
      characterData: false,
    })
  }

  const form = uiBuilder.form([
    uiBuilder.div(
      [...uiBuilder.label(await translate("Email"), inputEmail)],
      "form-group",
    ),
    uiBuilder.div([
      ...uiBuilder.label(await translate("Username"), inputUsername),
      uiBuilder.p(
        await translate(
          "Public name that will be shown in your comments. Has to be unique.",
        ),
        "form-group-description",
      ),
    ]),
    uiBuilder.div(
      [
        uiBuilder.button(
          await translate("Create account"),
          "peertube-button-big primary-button",
        ),
      ],
      "form-group text-center",
    ),
  ])

  {
    let isUsernameDirty = false

    inputEmail.addEventListener("input", () => {
      if (isUsernameDirty) return

      const [mailUsername] = inputEmail.value.split("@")
      inputUsername.setAttribute("value", mailUsername)
    })

    inputUsername.addEventListener("keydown", () => {
      isUsernameDirty = true
    })

    inputUsername.addEventListener("input", () => {
      const validate = new RegExp(`^${USER_USERNAME_REGEX_CHARACTERS}+$`).test(
        inputUsername.value,
      )

      // TODO: Respond to ui
      console.log({ validate })
    })

    form.addEventListener("submit", (event) => {
      event.preventDefault()

      onSubmit({
        email: inputEmail.value,
        username: inputUsername.value,
      }).catch((err: unknown) => {
        console.error(err)
      })
    })
  }

  rootEl.appendChild(
    uiBuilder.div(
      [
        uiBuilder.h2(await translate("Create account")),
        uiBuilder.div(
          [
            uiBuilder.div([form], "col-12 col-md-6"),
            uiBuilder.div(
              [
                uiBuilder.p(
                  await translate("With an account you'll be able to:"),
                ),
                uiBuilder.ul([
                  await translate(
                    "Become premium member to watch premium videos.",
                  ),
                  await translate("Comment on videos."),
                  await translate(
                    "Subscribe and get notification when new videos are published.",
                  ),
                ]),
              ],
              "col-12 col-md-6",
            ),
          ],
          "row",
        ),
      ],
      "",
    ),
  )
}
