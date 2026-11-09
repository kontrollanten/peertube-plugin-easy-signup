import type { RegisterClientOptions } from "@peertube/peertube-types/client"
import { buildForm } from "./ui-form"

function register({
  peertubeHelpers,
  registerClientRoute,
  registerHook,
  router,
}: RegisterClientOptions & {
  router: {
    navigateByUrl: (url: string) => void
  }
}): void {
  const serverConfig = peertubeHelpers.getServerConfig()

  registerClientRoute({
    route: "/easy-signup",
    onMount: ({ rootEl }) => {
      if (peertubeHelpers.isLoggedIn()) {
        router.navigateByUrl("/")
      }

      try {
        localStorage.setItem("no_account_setup_warning_modal", "true")
      } catch (err) {
        console.error("Failed to set localstorage", err)
      }

      buildForm(
        rootEl,
        peertubeHelpers.translate,
        peertubeHelpers.showModal,
        serverConfig,
      ).catch((err: unknown) => {
        console.error(err)
      })
    },
  })

  registerHook({
    target: "action:signup.register.init",
    handler: () => {
      router.navigateByUrl("/p/easy-signup" + window.location.search)
    },
  })
}

export { register }
