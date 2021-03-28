require "./json/lib/json/pure"
require "./json/lib/json/pure/add/exception"

# send a lens output
def output (id, data)
  STDERR.puts(JSON.generate(command: 'output', args: [id.to_s, data]))
end

# send an exception
def __send_exception (exception)
  error_info = {
    type: exception.class.name,
    message: exception.message,
    stack: exception.backtrace_locations.map { |loc|
      {
        line: loc.lineno(),
        column: 0,
        filename: loc.path(),
        codeAtLine: loc.base_label()
      }
    }
  }

  STDERR.puts(JSON.generate(command: 'error', args: [error_info]))
end

map_code, reduce_code = ARGV

map_lambda = eval("lambda { |path, data| \n" + map_code + "\n } \n")
reduce_lambda = eval("lambda { |left, right| \n" + reduce_code + "\n }\n")