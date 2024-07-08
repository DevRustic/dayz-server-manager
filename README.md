# DayZ Server Manager (Fork for Rustic)

[![GitHub Workflow Status](https://github.com/DevRustic/dayz-server-manager/actions/workflows/build.yml/badge.svg)](https://github.com/DevRustic/dayz-server-manager)
[![CodeCoverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/devrustic/140b7e570778165354c56506bfdaaf5b/raw/dayz-server-manager__master.json)](https://github.com/DevRustic/dayz-server-manager)

![Web UI Dashboard](/resources/webui_dashboard_screen.png "Web UI Dashboard")

![Web UI System](/resources/webui_system_screen.png "Web UI System")

![Web UI TypesEditor](/resources/webui_types_editor_screen.png "Web UI Types Editor")

![Web UI Logs](/resources/webui_logs_screen.png "Web UI Logs")

![Web UI Map](/resources/webui_map_screen.png "Web UI Map")

![Web UI Settings](/resources/webui_settings_screen.png "Web UI Settings")

  
Some important values you probably want to change:<br>
| | |
| --- | --- |
| instanceId | some unique name of this server instance |
| admins | the admins / moderators who can access the web ui and the discord commands |
| discordBotToken | the token the server manager will use to send messages to your discord server |
| discordChannels | the channels of your discord server to send messages to (make sure the bot has access to them) |
| rconPassword | the server's rcon password `!IMPORTANT! change this or others might be able to take control over your server` |
| localMods | list of manually install mods which are not auto updated via steam cmd |
| steamUsername / steamPassword | the credentials to use to download the server files and workshop mods |
| steamWsMods | the steam workshop mods to download |
| events | scheduled events for stuff like server restarts, global messages and so on |
| serverCfg.hostname | the name of the server in the server browser |
| serverCfg.password | the password of the game server |
| serverCfg.passwordAdmin | the admin password of the game server `!IMPORTANT! change this or others might be able to take control over your server` |

Below you will find a list of guides on how to edit these values.


<br><a name="guide-add-local-mods"></a>
### Adding local / manually installed mods <hr>  

Local mods are mods which you manually install and update. The server manager will only add them to the server startup parameters.<br>
Example:<br>
```json
"localMods": [
  "@MyAwesomeMod",
  "path/to/my/@OtherAwesomeMod",
],
```

<br><a name="guide-add-workshop-mods"></a>
### Adding workshop mods <hr>  

Workshop mods will be downloaded and updated everytime the server restarts (if not configured otherwise).<br>
The steamWsMods property specifies a list of workshop mods to download.<br>
There are two possible syntaxes: <br>

```json
"steamWsMods": [
  "1559212036",
  "1565871491"
],

```

or

```json
"steamWsMods": [
  {
    "workshopId": "1559212036",
    "name": "CF"
  },
  {
    "workshopId": "1565871491",
    "name": "BuilderItems"
  }
],
```

Hint: The name of the mod is only there to make the config more readable. You can enter whatever you want.<br>
Hint: You can mix the syntaxes<br>

<br><a name="guide-change-server-name-password"></a>
### Changing the server name / password / admin password <hr>  

* Open the `server-manager.json`
* find the `serverCfg` entry
* within this entry:
  * change the `hostname` property to change the server name
  * change the `password` property to change the server's password
  * change the `passwordAdmin` property to change the server's admin password

<br><a name="guide-change-server-port"></a>
### Changing the server port <hr>  

You might need to host your server on another port, because you want to host multiple servers on the same machine  
or whatever the reason might be.<br>

HowTo:<br>
* Open the `server-manager.json`
* find the `serverPort` property and change it to the desired port
* if you want to run multiple servers
  * find the `serverCfg` entry
  * in the this entry change the `steamQueryPort` property to the value of: `serverPort` + 3



<br><a name="guide-add-events"></a>
### Adding events <hr>  

Events are used to do tasks that are occurring at specific points in time.<br>
Typical examples would be regular server restarts and global messages to promote the server's discord.<br>
The following example shows exactly this.<br>
It is scheduling:
* a restart every 4 hours
* global messages every 15 minutes

The scheduling pattern is the CRON pattern.<br>
There are free websites to generate these peatterns pretty easily:
* [CronTab.guru](https://crontab.guru/)
* [CronJob.xyz](https://cronjob.xyz/)

For more details see the description in the `server-manager.json` itself.<br>

Example:<br>
```json
...
"events": [
    {
        "name": "Restart every 4 hours",
        "type": "restart",
        "cron": "0 0/4 * * *"
    },
    {
        "name": "Some Message",
        "type": "message",
        "cron": "0/15 * * * *",
        "params": [
            "Hello world"
        ]
    }
],
...
```

<br><a name="guide-add-hooks"></a>
### Adding hooks <hr>  

Hooks can be used to trigger external scripts or programs on certain events.  
This can be useful to so manual configuration or other custom stuff.

Possible hook types are:

* beforeStart - triggered right before server start
* missionChanged - triggered after the mission files were changed (i.e. types editor save)

In the server manager config add a hook object to the hooks array like so:  

```json
...
"hooks": [
  {
    "type": "beforeStart",
    "program": "path/to/your/script.bat"
  }
],
...
```

<br><a name="linux-server"></a>  
## Linux Server <hr>

The manager was tested on Ubuntu 22 (latest).
Other up2date debian variants should work as well.
<br>
The DayZServer only works on x86 platforms, ARM is NOT supported!
<br>
The manager can be run via the binary (recommended) or docker.<br>
The main downside when run with docker:  
If the manager crashes or shuts down, your dayz server will also be shut down.

### Docker

The manager is also published as a docker image:  
`ghcr.io/devrustic/dayz-server-manager:latest`
<br>
If you run the manager inside docker, the dayz server will also start in the same container.
If you stop the manager, the dayz server will stop as well.

How-To:

1. Create a directory for your server and make sure its accessible
   ```sh
   mkdir /dayz
   chmod 777 /dayz
   ```

2. Copy your `server-manager.json` inside that dir

3. Copy the `docker-compose.yml` from the repository to that dir.

4. Start the server manager:
   ```sh
   docker compose up -d
   ```
