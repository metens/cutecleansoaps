import string
import secrets

def generate_password(length: int) -> str:
    if length < 4:
        raise ValueError("Password length must be at least 4")

    # Character sets
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    symbols = string.punctuation

    # Ensure at least one from each category
    password_chars = [
        secrets.choice(lowercase),
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]

    # Pool of all characters
    all_chars = lowercase + uppercase + digits + symbols

    # Fill the rest of the password
    for _ in range(length - 4):
        password_chars.append(secrets.choice(all_chars))

    # Securely shuffle
    secrets.SystemRandom().shuffle(password_chars)

    return "".join(password_chars)


# Example usage
if __name__ == "__main__":
    length = int(input("Password length: "))
    print(generate_password(length))

