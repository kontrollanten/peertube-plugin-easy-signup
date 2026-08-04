import { UiBuilder } from "./ui-builder"
import type { RegisterClientHelpers } from "@peertube/peertube-types/client"

const USER_USERNAME_REGEX_CHARACTERS = "[a-z0-9_]*([a-z0-9_.\\-]*[a-z0-9_]*)?"
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
  registrationReason,
  username,
}: {
  email: string
  registrationReason?: string
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
      registrationReason,
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
  } catch (_e: unknown) {}

  console.error("Bad response", response)

  return {
    success: false,
    errorFields,
    error: await translate(
      response.status === 403
        ? "User registration is not available."
        : response.status === 409
          ? (jsonResponse as { detail: string }).detail
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
}): Promise<{ isAuthenticated: boolean; isEmailVerified?: boolean }> => {
  if (clientId === null || clientSecret === null) {
    console.error("Failed to get client credentials", {
      clientId,
      clientSecret,
    })

    return { isAuthenticated: false }
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

    if (!tokenResponse.ok) {
      try {
        const errResponse = (await tokenResponse.json()) as { code?: string }

        return {
          isAuthenticated: false,
          isEmailVerified: errResponse.code !== "email_not_verified",
        }
      } catch (err) {
        console.error(err)

        return { isAuthenticated: false }
      }
    }

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

    return { isAuthenticated: true }
  }
}

const onSubmit = async ({
  email,
  username,
  requiresApproval,
}: {
  email: string
  requiresApproval: boolean
  username: string
}): Promise<
  | {
      success: true
      isEmailVerified?: boolean
      isPending: boolean
      isLoggedIn: boolean
    }
  | { success: false; error: string; errorFields: string[] }
> => {
  const registrationResult = await handleRegistration({
    email,
    username,
    registrationReason: requiresApproval
      ? "Skipped by easy signup plugin"
      : undefined,
  })

  if (!registrationResult.success) {
    return {
      success: false,
      error: registrationResult.error,
      errorFields: registrationResult.errorFields,
    }
  }

  if (registrationResult.isPending) {
    return {
      success: true,
      isPending: true,
      isLoggedIn: false,
    }
  }

  try {
    const authResult = await handleAuthentication({
      email,
      username,
      password: registrationResult.password,
    })

    return {
      success: true,
      isEmailVerified: authResult.isEmailVerified !== false,
      isLoggedIn: authResult.isAuthenticated,
      isPending: false,
    }
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
  showModal: RegisterClientHelpers["showModal"],
  serverConfigProm: ReturnType<RegisterClientHelpers["getServerConfig"]>,
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
  inputUsername.setAttribute("pattern", USER_USERNAME_REGEX_CHARACTERS)
  inputUsername.setAttribute("minlength", "1")
  inputUsername.setAttribute("maxlength", "50")

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
      uiBuilder.label(await translate("Email"), inputEmail),
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
    uiBuilder.div([], "form-error"),
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
      if (!isUsernameDirty) {
        const [mailUsername] = inputEmail.value.split("@")
        inputUsername.setAttribute("value", mailUsername)
        inputUsername.value = mailUsername
        inputUsername.checkValidity()
      }
    })

    const inputValidations: Array<[HTMLInputElement, string]> = [
      [inputEmail, "Invalid email"],
      [inputUsername, "Invalid username"],
    ] as const

    inputValidations.forEach(([inputElem]) => {
      inputElem.addEventListener("keydown", () => {
        inputElem.setCustomValidity("") // Reset server validation error
      })

      let isValid = true

      inputElem.addEventListener("blur", () => {
        if (isValid && !inputElem.checkValidity()) {
          isValid = false
          inputElem.reportValidity()
        } else {
          isValid = true
        }
      })
    })

    inputUsername.addEventListener("keydown", () => {
      isUsernameDirty = true
    })

    const showFormError = async (val?: string) => {
      const errMsg = val ?? (await translate("An unexpected error occured"))

      const formErrEl = rootEl.querySelector(".form-error")

      if (!formErrEl) {
        console.error("easy-signup: Failed to find form-error element.")
        alert(errMsg)

        return
      }

      formErrEl.innerHTML = errMsg
    }

    const serverConfig = await serverConfigProm

    form.addEventListener("submit", (event) => {
      event.preventDefault()

      onSubmit({
        email: inputEmail.value,
        username: inputUsername.value,
        requiresApproval: serverConfig.signup.requiresApproval,
      })
        .then(async (result) => {
          if (result.success) {
            if (!result.isEmailVerified) {
              showModal({
                title: await translate("Your account is created"),
                content: await translate(
                  "Check your email inbox in order to verify your email address.",
                ),
                close: true,
              })
            }

            if (result.isPending) {
              showModal({
                title: await translate("Your account request is sent"),
                content: await translate(
                  "A moderator will review your registration, you'll get an email when it's ready to use.",
                ),
                close: true,
              })
              return
            }

            if (result.isLoggedIn) {
              const redirectPath = new URLSearchParams(
                window.location.search,
              ).get("redirect")

              if (redirectPath) {
                window.location.href = redirectPath
              } else {
                window.location.reload()
              }

              return
            } else {
              showModal({
                title: await translate("Failed to login"),
                content: await translate(
                  "Your account is created but we failed to login to your account. Try to reset your password.",
                ),
                close: true,
              })
              return
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (result.errorFields?.length) {
            if (result.errorFields.includes("email")) {
              inputEmail.setCustomValidity(await translate("Invalid email"))
              inputEmail.reportValidity()
            }

            if (result.errorFields.includes("username")) {
              inputUsername.setCustomValidity(
                await translate("Invalid username"),
              )
              inputUsername.reportValidity()
            }

            return
          }

          await showFormError(result.error)
        })
        .catch((err: unknown) => {
          console.error(err)
          void showFormError()
        })
    })
  }

  rootEl.appendChild(
    uiBuilder.div(
      [
        uiBuilder.h2(await translate("Create account"), "mb-5"),
        uiBuilder.div(
          [
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
              "col-12 col-md-6 gx-6",
            ),
            uiBuilder.div([form], "col-12 col-md-6 gx-6"),
          ],
          "row row-reverse",
        ),
      ],
      "",
    ),
  )
}
