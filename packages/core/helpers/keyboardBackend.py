import pyautogui
import json
import time
import sys

"""
JSON expected:
{
    "type"?: "keypress" | "sequence" | "shortcut"
    "hold"?: float
    "delay"?: float
    "keys"?: str | str[]
    "exit"?: bool
    "reference": f"{string}-{string}-{string}-{string}-{string}"
}
"""

class KeyboardBackend:
    exit = False

    def respond(self, code: str, reference: str):
        response = { 
            "code": code,
            "reference": reference
        }

        print(json.dumps(response), flush=True)

    def keypress(self, key: str, hold: float | int, reference: str):
        if pyautogui.isValidKey(key):
            pyautogui.keyDown(key)
            time.sleep(hold / 1000)
            pyautogui.keyUp(key)

            self.respond("OK", reference)
        else:
            self.respond("INVALID_KEY", reference)

    def sequence(self, text: str | list[str], delay: float | int, hold: float | int, reference: str):
        for key in text:
            if pyautogui.isValidKey(key):
                pyautogui.keyDown(key)
                time.sleep(hold / 1000)
                pyautogui.keyUp(key)
                time.sleep(delay / 1000)
            else:
                self.respond("INVALID_KEY", reference)
                return
        self.respond("OK", reference)

    def shortcut(self, keys: list[str], hold: float | int, reference: str):
        pressedKeys = []

        try:
            for key in keys:
                if not pyautogui.isValidKey(key):
                    self.respond("INVALID_KEY", reference)
                    return

                pyautogui.keyDown(key)
                pressedKeys.append(key)

            time.sleep(hold / 1000)

            self.respond("OK", reference)
        except Exception as e:
            self.respond("ERROR", reference)
            print(e, file=sys.stderr)
        finally:
            for key in reversed(pressedKeys):
                pyautogui.keyUp(key)
    
    def start(self):
        while True:
            data = input()
            parsedData = json.loads(data)

            if parsedData.get("exit", False):
                break
    
            pressType = parsedData["type"]
            hold = parsedData.get("hold", 0)
    
            try:
                match pressType:
                    case "keypress":
                        self.keypress(parsedData["keys"], hold, parsedData["reference"])
                    case "sequence":
                        self.sequence(parsedData["keys"], parsedData.get("delay", 0), hold, parsedData["reference"])
                    case "shortcut":
                        self.shortcut(parsedData["keys"], hold, parsedData["reference"])
                    case _:
                        self.respond("ERROR", parsedData["reference"])
            except Exception as e:
                self.respond("ERROR", parsedData["reference"])
                print(e, file=sys.stderr, flush=True)

backend = KeyboardBackend()

backend.start()