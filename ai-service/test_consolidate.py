from consolidate import merge_rules

rules = merge_rules(
    "",
    [
        "طويلة كتير وفيها إيموجي زيادة، بدنا جمل قصيرة ومن غير إيموجي",
        "اللهجة خليجية والجمهور شامي، استعملي لهجة شامية",
    ],
)
open("rules_test.txt", "w", encoding="utf-8").write(rules)
print("saved to rules_test.txt")