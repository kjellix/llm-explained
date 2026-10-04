/* ==========================================================================
   LX glossary — every abbreviation used anywhere in the course.
   full: written-out form · def: one-sentence meaning · say: how the voice
   should pronounce it (used by the text-to-speech step).
   In chapter HTML write <abbr>MLP</abbr>; the first use in each chapter is
   expanded automatically and every use gets a hover card.
   ========================================================================== */
LX.glossary = {
  AI:      { full: "Artificial Intelligence", say: "A I", def: "Computer systems that perform tasks we associate with human intelligence." },
  LLM:     { full: "Large Language Model", say: "L L M", def: "A neural network with billions of parameters, trained to predict the next token of text." },
  GPU:     { full: "Graphics Processing Unit", say: "G P U", def: "A chip with thousands of small cores that do many multiplications in parallel; the workhorse for running models." },
  FLOP:    { full: "Floating-Point Operation", say: "flop", def: "One addition or multiplication on decimal numbers. TFLOPS = trillions of them per second." },
  TFLOPS:  { full: "Tera Floating-Point Operations per Second", say: "teraflops", def: "10¹² floating-point operations per second, the usual unit for a chip's compute." },
  BPE:     { full: "Byte-Pair Encoding", say: "B P E", def: "A tokenization method that starts from bytes and repeatedly merges the most frequent neighbouring pair into a new token." },
  UTF8:    { full: "Unicode Transformation Format, 8-bit", say: "U T F eight", def: "The standard way of storing any character as 1 to 4 bytes." },
  ID:      { full: "Identifier", say: "I D", def: "The whole number that names one token in the vocabulary." },
  GPT:     { full: "Generative Pre-trained Transformer", say: "G P T", def: "OpenAI's family of decoder-only transformers; also used loosely for any text-generating transformer." },
  BERT:    { full: "Bidirectional Encoder Representations from Transformers", say: "bert", def: "Google's encoder-only transformer from 2018; reads text in both directions to understand it, but does not write." },
  MLA:     { full: "Multi-head Latent Attention", say: "M L A", def: "DeepSeek's attention variant that stores a small compressed vector per token instead of full keys and values, shrinking the KV cache." },
  RNN:     { full: "Recurrent Neural Network", say: "R N N", def: "A network that reads a sequence one step at a time and carries a hidden state forward, instead of looking back at all earlier tokens." },
  MLP:     { full: "Multi-Layer Perceptron", say: "M L P", def: "The feed-forward part of each layer: expand the vector, apply a non-linear function, project it back." },
  FFN:     { full: "Feed-Forward Network", say: "F F N", def: "Another name for the MLP block." },
  GLU:     { full: "Gated Linear Unit", say: "G L U", def: "A layer where one projection is multiplied element by element with a second, gating projection." },
  SwiGLU:  { full: "Swish-Gated Linear Unit", say: "swig-loo", def: "A GLU whose gate uses the Swish (SiLU) activation; the MLP type used by Qwen3.8." },
  SiLU:    { full: "Sigmoid Linear Unit", say: "sigh-loo", def: "The activation x · sigmoid(x), also called Swish. Smooth, lets small negative values through." },
  ReLU:    { full: "Rectified Linear Unit", say: "ray-loo", def: "The activation max(0, x): negative values become zero." },
  GELU:    { full: "Gaussian Error Linear Unit", say: "jelloo", def: "A smooth activation, x times the probability a standard normal value is below x; used in the vision encoder." },
  LayerNorm: { full: "Layer Normalization", say: "layer norm", def: "Subtracts a vector's mean and divides by its standard deviation, then applies learned scale and bias; RMSNorm is its simpler cousin." },
  RMSNorm: { full: "Root Mean Square Normalization", say: "R M S norm", def: "Rescales a vector so its root-mean-square size is 1, then multiplies by learned weights." },
  RoPE:    { full: "Rotary Position Embedding", say: "rope", def: "Encodes a token's position by rotating pairs of numbers in its query and key vectors by position-dependent angles." },
  mRoPE:   { full: "Multimodal Rotary Position Embedding", say: "M rope", def: "RoPE with separate angle groups for time, height and width, so image and video tokens get 3-D positions." },
  QKV:     { full: "Query, Key, Value", say: "Q K V", def: "The three vectors every token produces for attention." },
  GQA:     { full: "Grouped-Query Attention", say: "G Q A", def: "Several query heads share one key/value head, which shrinks the KV cache." },
  MHA:     { full: "Multi-Head Attention", say: "M H A", def: "Attention split into several heads that each look for different relationships." },
  KV:      { full: "Key-Value", say: "K V", def: "The key and value vectors of earlier tokens, as stored in the KV cache." },
  SSM:     { full: "State Space Model", say: "S S M", def: "A sequence model that carries a fixed-size state from token to token instead of looking back at all tokens." },
  MoE:     { full: "Mixture of Experts", say: "M O E", def: "A layer with many MLP 'experts' where a router picks a few per token." },
  MTP:     { full: "Multi-Token Prediction", say: "M T P", def: "An extra head that predicts tokens further ahead; used to draft tokens for speculative decoding." },
  ViT:     { full: "Vision Transformer", say: "vit", def: "A transformer that cuts an image into patches and treats each patch like a token." },
  bf16:    { full: "Brain Floating Point, 16-bit", say: "B F sixteen", def: "A 16-bit number format with the same range as 32-bit floats but less precision; the format Qwen3.8 is stored in." },
  fp32:    { full: "32-bit Floating Point", say: "F P thirty-two", def: "Standard single-precision number format (4 bytes)." },
  Q4:      { full: "4-bit Quantization", say: "Q four", def: "Storing weights with about 4 bits each instead of 16, making the model about 4× smaller at a small quality cost." },
  GiB:     { full: "Gibibyte", say: "gigabytes", def: "2³⁰ = 1,073,741,824 bytes, about 7% more than a gigabyte (10⁹ bytes). Memory is usually counted this way; in speech it is simply called a gigabyte." },
  KiB:     { full: "Kibibyte", say: "kilobytes", def: "2¹⁰ = 1,024 bytes, about 2% more than a kilobyte (1,000 bytes)." },
  MiB:     { full: "Mebibyte", say: "megabytes", def: "2²⁰ = 1,048,576 bytes, about 5% more than a megabyte (10⁶ bytes)." },
  L2:      { full: "L2 norm (Euclidean length)", say: "L two", def: "The length of a vector: the square root of the sum of its squared entries." },
  EOS:     { full: "End of Sequence", say: "E O S", def: "A special token that tells the generation loop to stop." },
  TTS:     { full: "Text-to-Speech", say: "T T S", def: "Software that turns written text into spoken audio." },
};
