# Horse-link Scripts

These utility scripts are run with ts-node e.g. `npx ts-node scripts/settle.py` or `npx ts-node scripts/settle.py`

## Automation

These scripts are run through cron on 170.64.176.240

The scripts log to the `/root/logs` directory there, so you can see what they're doing with `ssh root@170.64.176.240 tail -F logs/*.log`

To update the commands or the frequency `ssh root@170.64.176.240` and then `crontab -e`.

Things might get "funny" if the scripts are restarted before they finish. For now, `crontab -l` shows the actual commands and time will give us an example duration.  e.g. `time npx ts-node scripts/settle.py` showed `real   3m15.799s`, so we don't want to run it more often than that.

## Updating

Deploy by either copying the scripts over:
`scp scripts/*.ts root@170.64.176.240:contracts.horse.link/scripts/`
 or pulling the updated code:
`ssh root@170.64.176.240 "sh -c 'cd contracts.horse.link; git pull'"`

I've installed ts-node on 170.64.176.240 so we can run it the same there.

Rather than installing tsc on the server, it would be prefereable to deploy the compiled js, but right now `tsc` complains about some of our dependencies, so someone would need to resolve that first.
