import messages from './tasks.json' assert {
    type: 'json',
}

import Fuse from 'fuse.js';
import fs from 'fs';
import papaparse from 'papaparse';

function display(tasks) {
    tasks.forEach((t, i) => console.log(`${i+1}) ${t.trim()}`))
}

function scanTasks(messages) {
    const tasks = [];
    
    let nextTaskNumber = 1;
    let re = new RegExp(`${nextTaskNumber} ?\\)((\\n|.)*)`);
    
    for (const message of messages) {
        let messageMatch = message.normalize().replace('\uff09', ')').match(re);

        while (messageMatch) {
            nextTaskNumber += 1;
            re = new RegExp(`${nextTaskNumber} ?\\)((\\n|.)*)`);

            const nextMatch = messageMatch[1].match(re);

            if (nextMatch) {
                tasks.push(messageMatch[1].slice(0, nextMatch.index));
            } else {
                tasks.push(messageMatch[1]);
            }

            messageMatch = nextMatch;
        }
    }

    return tasks;
}

const tasks = papaparse.parse(fs.readFileSync("./scripts/ricky-tasks.csv", "utf-8"), { header: true });

const discordTasks = scanTasks(messages);

const fuse = new Fuse(discordTasks, {
    findAllMatches: true,
    includeScore: true,
    shouldSort: true,
    threshold: 1.0,
    ignoreLocation: true,
});

const newTasks = discordTasks.map((task, idx) => ({
    number: idx + 1,
    task: task.trim(),
}));

for (const task of tasks.data) {
    const hit = fuse.search(task.task)[0];
    
    newTasks[hit.refIndex] = { ...task, ...newTasks[hit.refIndex] };
}

fs.writeFileSync("newTasks.csv", papaparse.unparse(newTasks), "utf-8");