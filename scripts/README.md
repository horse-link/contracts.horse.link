#### Horse-link Scripts

These utility scripts are run directly with python, e.g.
`python settle.py` or `python scratch.py`

#### Automation

These scripts are run through cron on 170.64.176.240

The scripts log to the `/root/logs` directory there, so you can see what they're doing with `ssh root@170.64.176.240 tail -F logs/*.log`

To update the commands or the frequency `ssh root@170.64.176.240` and then `crontab -e`.

Things might get "funny" if the scripts are restarted before they finish. For now, `crontab -l` shows the actual commands and time will give us an example duration.  e.g. `time /usr/bin/python3 -u /root/contracts.horse.link/scripts/settle.py` shows `real	3m15.799s`, so we don't want to run it more often than that.

### Updating

For now, I've just manually uploaded the settle script and will need to be updated as part of the deployment process:
`scp scratch.py root@170.64.176.240:contracts.horse.link/scripts/scratch.py`
