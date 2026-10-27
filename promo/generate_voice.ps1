Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
$outputFile = "c:\Users\Hp\LOST&FOUNDAPP\promo\voiceover.wav"
$synth.SetOutputToWaveFile($outputFile)
$scriptText = "Naiwan mo ba ang iyong gamit sa campus? Huwag mag-alala. Nandito na ang E-Sauli. Instant smart matching. Ligtas na cryptographic verification laban sa pekeng claimant. At may Aura points pa para sa tapat na nagbabalik. E-Sauli: Ang bilis maibalik, ligtas at mapagkakatiwalaan."
$synth.Speak($scriptText)
$synth.Dispose()
Write-Output "Voiceover audio created successfully at $outputFile"
