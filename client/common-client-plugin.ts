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
  registerClientRoute({
    route: "/easy-signup",
    onMount: ({ rootEl }) => {
      if (peertubeHelpers.isLoggedIn()) {
        router.navigateByUrl("/")
      }

      buildForm(rootEl, peertubeHelpers.translate).catch((err: unknown) => {
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
