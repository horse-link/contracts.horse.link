#!python3

def did_place(n, results):
    # Convert octal result value to binary format
    runners = format(results, '03b')

    # Extract individual result bits
    win = bool(int(runners[0]))

    return win



# Example Placements
# placed_runners = [1, 3, 8]
# bitmap = 2^1 + 2^3 + 2^8 = 1 + 8 + 256 = 265

results = 265 # bitmap of placed runners
runner_to_check = 1

result = did_place(runner_to_check, results)

print("Value needed to pass: ", result)
