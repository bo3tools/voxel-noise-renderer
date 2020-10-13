/* jshint node: true, esversion: 8 */

const readline = require("readline");
const EventEmitter = require("events").EventEmitter;

class CommandPrompt {
    constructor() {
        this.commandsToComplete = [];
        this.eventEmitter = new EventEmitter();
        this.promptActive = false;

        this.cliInterface = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            completer: this.handleAutoComplete.bind(this),
            prompt: "> "
        });

        this.cliInterface.on("line", (line) => {
            const input = line.trim();
            const args = input.split(" ");
            const command = args[0];

            this.eventEmitter.emit("command", command, args.slice(1), input);
            this.cliInterface.prompt();
        });

        this.cliInterface.on("close", () => {
            this.promptActive = false;
            console.info("Quitting...");
            process.exit();
        });
    }

    handleAutoComplete(line) {
          const hits = this.commandsToComplete.filter((c) => c.startsWith(line));
          return [hits.length ? hits : this.commandsToComplete, line];
    }

    setCompleteCommands(...commandsToComplete) {
        this.commandsToComplete = commandsToComplete;
    }

    startPrompt() {
        if (!this.promptActive) {
            this.cliInterface.prompt();
            this.promptActive = true;
        }
    }

    on(event, handler) {
        this.eventEmitter.addListener(event, handler);
    }
}

module.exports = CommandPrompt;