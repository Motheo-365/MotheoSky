//COnvert text into structured command
function parseCommand(input) {
    const parts = input.split(" ");

    const command = parts[0];
    const args = parts.slice(1);

    if (!command) return null;

    return {
        command,
        args,
    };
}

module.exports = {
    parseCommand,
};