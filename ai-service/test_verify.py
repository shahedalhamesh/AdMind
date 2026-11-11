import verify

PROFILE = "- Client name: Test Cafe\n- Brand tone: short, playful"
KNOWLEDGE = (
    "[Menu]\nلاتيه 15 ريال. كابتشينو 14 ريال. اسبريسو 10 ريال.\n\n"
    "[Offers]\nخصم 20% لطلاب الجامعات عند إبراز بطاقة الطالب."
)

good = "لاتيه بـ 15 ريال بس! وخصم 20% لطلاب الجامعات."
bad = "لاتيه بـ 15 ريال بس! وخصم 50% لكل الزباين، والتوصيل مجاني للجميع."

out, status = verify.check(good, "بوست عن الأسعار", PROFILE, KNOWLEDGE)
print("GOOD -> status:", status, "(expect ok)")
print(out, "\n")

out, status = verify.check(bad, "بوست عن الأسعار", PROFILE, KNOWLEDGE)
print("BAD -> status:", status, "(expect corrected)")
print(out)