import djclick as click


@click.command()
@click.argument('dir', type=click.Path(exists=True))
def command(dir):
    click.secho(dir)
    
