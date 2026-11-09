import type { MAccountDefault, MChannelActor, MUserDefault, RegisterServerOptions, serverHookObject, UserRegister } from "@peertube/peertube-types";

interface RegisterServerHookOptions {
  target: (keyof typeof serverHookObject)
  handler: Function
}

async function register({
  peertubeHelpers,
  registerHook,
}: Omit<RegisterServerOptions, 'registerHook'> & { registerHook: (options: RegisterServerHookOptions) => void }): Promise<void> {
  const serverConfig = await peertubeHelpers.config.getServerConfig()
  const serverActor = await peertubeHelpers.server.getServerActor()

  registerHook({
    target: "action:api.user.registered",
    handler: ({ body, user, account, videoChannel, req, res }: { body: UserRegister; user: MUserDefault; account: MAccountDefault; videoChannel: MChannelActor; req: { acceptsLanguages: () => string[] }; res: Response }) => {
      const { email, password } = body
      const clientUrl = new URL(serverActor.url).origin
      const [language] = req.acceptsLanguages()

      if (user.emailVerified === false) {
        // The user needs to verify its email address, don't send any email.
        return
      }

      {
        const subject = (language === 'sv' ? 'Ditt konto är skapat på ' : 'Your account is created at ') + serverConfig.instance.name
        const title = (language === 'sv' ? 'Välkommen till ' : 'Welcome to ') + serverConfig.instance.name
        const text = (language === 'sv' ? 'Ditt konto är nu skapat och du kan logga in med lösenordet ' : 'Your account is created and you can now login with password ') + password
        const actionText = (language === 'sv' ? 'Besök ' : 'Vist ') +  + serverConfig.instance.name

        peertubeHelpers.email.createJob({
          to: {
            email,
            language,
          },
          subject,
          title,
          text,
          action: {
            text: actionText,
            url: clientUrl
          }
        })
        .catch(err => {
          peertubeHelpers.logger.error('Failed to send email', err)
        })
      }
    },
  })
}

async function unregister(): Promise<void> {
  await Promise.resolve();
}

module.exports = {
  register,
  unregister,
};
