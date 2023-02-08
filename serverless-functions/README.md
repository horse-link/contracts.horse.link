### WIP Serverless Functions

### Typescript

The config is probably not perfect, but I was able to generate the .js with the changes to the .tsconfig and the `--skipLibCheck` flag:

`tsc --skipLibCheck settle.ts`

I think all we need for a typescript port is:
- an appropriate environment
- the port

### Python

I got the dependencies installed with the `build.sh` and the `--remote-build` flag in `doctl serverless deploy .  --remote-build`

Open Problems:

- choose appropriate time and memory limits (currently 5 minutes and 512M)
- Set up the environment


[CloudOcean Dashboard](https://cloud.digitalocean.com/functions?i=7cba59)

#### Deploy

```
cd serverless-functions
doctl serverless deploy .  --remote-build
```

That `--remote-build` installs the python dependencies - it may not be necessary for js, which seems to pick up


There's a `watch` functionality that I haven't tried out yet.

#### Run
`doctl sls fn invoke contracts/settle`

Log:
`doctl sls activations logs -f contracts/settle -n 5`
(much better formatted in the command line than the dashboard)

#### Random Useful Commands

```
doctl serverless status

# just once
doctl auth list
#doctl auth init --context horse-link
doctl auth switch --context horse-link
doctl account get

#doctl serverless install
#doctl serverless namespaces create --label functions.horse.link --region syd1
# Connected to functions namespace 'fn-6e27bb78-8b4a-467e-af26-35d5957faf0d' on API host 'https://faas-syd1-c274eac6.doserverless.co'

#NOTE: digitalocean likes their short forms, so:
`doctl serverless function list`
means the same as
`doctl sls fn ls`



# note no 'function' on the undeploy
doctl sls undeploy sample/hello

```

